export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Setup CORS headers for development/remote clients
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-User, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Intercept POST request for API routes
    if (request.method === "POST" && url.pathname.startsWith("/api/")) {
      try {
        const body = await request.json();
        const userPrompt = body.question || "";
        const userHeader = request.headers.get("X-User");

        if (!userPrompt) {
          return new Response(JSON.stringify({ error: "Missing 'question' in body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const userId = (userHeader || "").trim().toLowerCase();
        if (!userId) {
          return new Response(JSON.stringify({ error: "Missing 'X-User' header" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 1. Retrieve user profile from D1
        const profile = await env.DB.prepare(
          "SELECT display_name, system_persona FROM user_profiles WHERE user_id = ?"
        ).bind(userId).first();

        if (!profile) {
          return new Response(JSON.stringify({ error: `User profile '${userId}' not found.` }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 2. Path request through Cloudflare AI Gateway cache layer
        const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_NAME}/workers-ai/v1/chat/completions`;

        const aiResponse = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.AI_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "@cf/meta/llama-3.1-8b-instruct",
            messages: [
              { role: "system", content: profile.system_persona },
              { role: "user", content: userPrompt }
            ]
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          return new Response(JSON.stringify({ error: "AI Gateway error", details: errorText }), {
            status: aiResponse.status,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const aiData = await aiResponse.json();
        const aiText = aiData.choices?.[0]?.message?.content || "";

        // 3. Log interaction to D1 (interaction_logs)
        await env.DB.prepare(
          "INSERT INTO interaction_logs (user_id, query, response) VALUES (?, ?, ?)"
        ).bind(userId, userPrompt, aiText).run();

        // 4. Return response to Blazor frontend
        return new Response(JSON.stringify({ response: aiText }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Default: Fallback to serve the Blazor static assets (wwwroot files)
    try {
      if (!env.ASSETS) {
        return new Response("Cloudflare Worker Assets binding (env.ASSETS) is missing. Check compatibility_date in wrangler.jsonc.", { status: 500 });
      }
      return await env.ASSETS.fetch(request);
    } catch (err) {
      return new Response(`Assets fetch failed: ${err.message}`, { status: 500 });
    }
  }
};
