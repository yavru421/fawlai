/**
 * FawlAI — Cloudflare Worker Edge Router
 *
 * Routes:
 *   POST /api/infer   → Tier A multi-model AI inference (fan-out pipeline)
 *   POST /api/*       → Legacy profile-aware single-model inference (D1)
 *   *                 → Blazor WASM static assets (env.ASSETS)
 *
 * Auth:    Cloudflare Zero Trust handles the network perimeter.
 *          No API keys or secrets are present in client-side code.
 * State:   Entirely stateless. No KV, Durable Objects, or session storage.
 */

// ── Model registry ────────────────────────────────────────────────────────────
const MODEL_MAP = {
  lint:      "@cf/qwen/qwen2.5-coder-32b-instruct",
  brainstorm: "@cf/meta/llama-3.1-8b-instruct-fp8",
  monitor:   "@cf/meta/llama-3.1-8b-instruct-fp8",
  summarize: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  refactor:  "@cf/moonshotai/kimi-k2.7-code",
};

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// ── CORS helpers ──────────────────────────────────────────────────────────────

/**
 * Builds CORS headers that reflect the caller's origin and allow credentials.
 * Wildcard origins are incompatible with credentials:true — we always reflect.
 * @param {string|null} origin - The value of the incoming Origin header.
 */
function buildCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":      origin || "*",
    "Access-Control-Allow-Methods":     "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age":           "86400",
  };
}

/**
 * Clones a Response and injects CORS headers into the clone.
 * @param {Response} response
 * @param {string|null} origin
 */
function addCorsHeaders(response, origin) {
  const headers = new Headers(response.headers);
  const cors = buildCorsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * POST /api/infer
 * Stateless multi-model inference routed through the Cloudflare AI Gateway.
 * Supports optional SSE streaming when the client sends Accept: text/event-stream.
 *
 * Request body: { task_type, prompt, chunkIndex, totalChunks }
 * Response:     { result, model, chunkIndex, totalChunks }  (or SSE stream)
 */
async function handleInfer(request, env, corsHeaders) {
  const body = await request.json();
  const { task_type = "summarize", prompt = "", chunkIndex = 0, totalChunks = 1 } = body;

  if (!prompt.trim()) {
    return new Response(JSON.stringify({ error: "Missing 'prompt' in body." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const model     = MODEL_MAP[task_type] ?? DEFAULT_MODEL;
  const wantsSSE  = (request.headers.get("Accept") || "").includes("text/event-stream");
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_NAME}/workers-ai/${model}`;

  const aiResponse = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.AI_TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      stream: wantsSSE,
    }),
  });

  if (!aiResponse.ok) {
    const detail = await aiResponse.text();
    return new Response(JSON.stringify({ error: "AI Gateway error", detail }), {
      status: aiResponse.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // ── SSE streaming path ──────────────────────────────────────────────────────
  if (wantsSSE) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          // Forward each chunk as an SSE data frame
          await writer.write(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
        }
        // Signal stream end
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type":  "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
        ...corsHeaders,
      },
    });
  }

  // ── Standard JSON path ──────────────────────────────────────────────────────
  const aiData  = await aiResponse.json();
  const result  = aiData?.result?.response
    ?? aiData?.choices?.[0]?.message?.content
    ?? "";

  return new Response(
    JSON.stringify({ result, model, chunkIndex, totalChunks }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

/**
 * POST /api/* (legacy — preserved)
 * Profile-aware single-model inference backed by D1 user profiles.
 * Requires X-User header. Logs interactions to interaction_logs.
 */
async function handleLegacyApi(request, env, corsHeaders) {
  const body = await request.json();
  const userPrompt = body.question || "";
  const userHeader = request.headers.get("X-User");

  if (!userPrompt) {
    return new Response(JSON.stringify({ error: "Missing 'question' in body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const userId = (userHeader || "").trim().toLowerCase();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing 'X-User' header" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // 1. Retrieve user profile from D1
  const profile = await env.DB.prepare(
    "SELECT display_name, system_persona FROM user_profiles WHERE user_id = ?"
  ).bind(userId).first();

  if (!profile) {
    return new Response(JSON.stringify({ error: `User profile '${userId}' not found.` }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // 2. Route through Cloudflare AI Gateway (OpenAI-compatible endpoint)
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_NAME}/workers-ai/v1/chat/completions`;

  const aiResponse = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.AI_TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model: "@cf/meta/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: profile.system_persona },
        { role: "user",   content: userPrompt },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    return new Response(JSON.stringify({ error: "AI Gateway error", details: errorText }), {
      status: aiResponse.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const aiData = await aiResponse.json();
  const aiText = aiData.choices?.[0]?.message?.content || "";

  // 3. Log interaction to D1
  await env.DB.prepare(
    "INSERT INTO interaction_logs (user_id, query, response) VALUES (?, ?, ?)"
  ).bind(userId, userPrompt, aiText).run();

  return new Response(JSON.stringify({ response: aiText }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ── Main fetch handler ────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors   = buildCorsHeaders(origin);

    // 1. CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // 2. POST /api/infer — Tier A fan-out pipeline
    if (request.method === "POST" && url.pathname === "/api/infer") {
      try {
        return await handleInfer(request, env, cors);
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }
    }

    // 3. POST /api/* — legacy profile-aware inference
    if (request.method === "POST" && url.pathname.startsWith("/api/")) {
      try {
        return await handleLegacyApi(request, env, cors);
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }
    }

    // 4. Static asset fallback — serve Blazor WASM
    try {
      if (!env.ASSETS) {
        return new Response(
          "Cloudflare Worker Assets binding (env.ASSETS) is missing. Check wrangler.jsonc.",
          { status: 500 }
        );
      }
      const assetResponse = await env.ASSETS.fetch(request);
      return addCorsHeaders(assetResponse, origin);
    } catch (err) {
      return new Response(`Assets fetch failed: ${err.message}`, { status: 500 });
    }
  },
};
