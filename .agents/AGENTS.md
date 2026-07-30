<RULE[AGENTS.md]>
**The ZLA Toolbox (Opt-In Architecture):**
- **Default Behavior:** ALWAYS default to standard, pragmatic engineering stacks. If a project requires a backend, a local database, or server-side APIs, build it without hesitation. 
- **ZLA Definition:** Zero-Liability Architecture (ZLA) strictly denotes a 100% client-side, backend-free, static web application.
- **When to Apply ZLA:** ONLY enforce ZLA constraints if the user EXPLICITLY requests it for the current project (e.g., "Let's build this as a ZLA app"). 
- **Marketing Context:** When ZLA *is* deployed, retain the name to establish authority (e.g., "Because it's ZLA, your server bill is $0 and you can't be hacked").
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Cloudflare Deployment Workflow:**
For ALL Cloudflare projects (Workers, Pages, or hybrid), NEVER run `wrangler deploy` or `npx wrangler deploy` directly to deploy frontend or full-stack apps.
The ONLY correct deployment workflow is:
1. `git add`
2. `git commit`
3. `git push origin main` (or the appropriate branch)

Cloudflare CI automatically builds and deploys on every push. Direct wrangler deploys bypass CI, skip the build pipeline, and cause version mismatches between what GitHub has and what is live.

*Exception*: If the project directory lacks a configured git remote repository (e.g., `git remote -v` returns no origin), the agent is permitted to execute `npx wrangler deploy` locally to update the service.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**`agy-mcp-server` Sidecar Execution Guidance:**
For complex multi-line scripts, DuckDB operations, and commands requiring structured argument arrays, PREFER using `agy-mcp-server` (`exec_cmd`) or dedicated script files (`.py`/`.ps1`) to prevent string-escaping bugs.
- Simple single-binary invocations (e.g., `git status`, `python script.py`, `conda list`) MAY use native `run_command` directly.
- Raw inline multi-statement PowerShell strings via `run_command` remain DISCOURAGED due to escaping fragility.
- When in doubt, use `agy-mcp-server` or write a dedicated script file.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Canonical DuckDB Database Registry & Command Invariant:**
All DuckDB database queries MUST use the explicit, absolute paths registered below without runtime path guessing or exploratory checks:
- **`mind.duckdb`**: `C:\Users\John\.gemini\config\mind.duckdb`
- **`agent_memory.duckdb`**: `C:\Users\John\.gemini\config\agent_memory.duckdb`
- **`st_codex.duckdb`**: `C:\Users\John\.gemini\config\st_codex.duckdb`

Before invoking `run_command` or Python DuckDB scripts, the agent MUST explicitly target these exact paths. Never construct relative paths, infer session directories, or run exploratory file sweeps.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Command Failure Resolution (No Bandaids):**
If you, an Antigravity agent, run a command (e.g. via `run_command` or background tasks) and it FAILS, you MUST:
1. Immediately log the failure.
2. DO NOT move on or continue with subsequent steps.
3. Completely resolve the underlying failure to guarantee CORRECTNESS (do NOT use bandaid fixes or workarounds).
4. Verify the command succeeds before proceeding with the rest of your task.
This is non-negotiable and must be handled with utmost priority to prevent cascading errors and silent failures.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Friction Elimination & Auto-Correction Invariant:**
- **Definition**: FRICTION occurs whenever the agent misinterprets operator intent, loops on broken patterns, or requires repeated corrections.
- **Mandatory Action**: FRICTION is strictly treated as a hard system configuration bug. The agent MUST:
  1. Immediately suspend current assumptions.
  2. Query DuckDB for historical context and past solutions via `db_session.py`.
  3. Execute sequential thinking (`sequentialthinking` MCP tool) to analyze the root cause step-by-step.
  4. Propose or apply permanent rule/skill updates (`/learn`) so the failure mode can NEVER recur.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**NTFS Single-Source-of-Truth Hard-Link Invariant:**
Whenever initializing, updating, or maintaining system-wide configuration files (`AGENTS.md`, `.agentsignore`, `db_session.py`), the agent MUST enforce single-source-of-truth storage at `C:\Users\John\.gemini\config\` and maintain NTFS hard links (`os.link`) to all workspace target directories. Never create isolated copy duplicates of system configuration files.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Pure Engineering & Curiosity-Driven R&D Invariant:**
When brainstorming, exploring system architectures, or proposing R&D vectors, NEVER frame ideas around monetary metrics ($$ savings, ROI, enterprise cost reduction, or commercial SaaS replacement) unless explicitly requested by the user. 
Focus EXCLUSIVELY on raw technical curiosity, computational elegance, hardware acceleration, novel system paradigms, and tangible daily friction elimination.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Semantic Trajectory & Operator Identity Invariant:**
Whenever summarizing or visualizing historical telemetry, user growth, or session history (e.g. `/remember_recent`, `/telemetry`, `/mind`), NEVER default to generic process metadata (such as step volume, diurnal activity, or window focus). 
Telemetry MUST always perform semantic/linguistic extraction to visualize:
1. Toolchain & IDE Transitions (e.g., VSCode -> Cursor).
2. AI Model & Engine Supremacy (e.g., Antigravity vs OpenAI/Claude).
3. Core Architectural Entrenchment (e.g., Cloudflare Edge, ZLA, DuckDB, PowerShell).
4. Philosophical & Technical Milestones (e.g., Codex manifestos and breakthroughs).
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Concrete Deliverables & Project Telemetry Invariant:**
Whenever summarizing or visualizing telemetry via `/remember_recent` or `/telemetry`, NEVER output abstract keyword-frequency line charts or word counts.
Telemetry MUST ALWAYS query disk modification timestamps (c:\dev\) and active DuckDB solution records to display:
1. Real Project Modification Timestamps (Exact date, time, and target files).
2. Live Edge & Cloudflare Infrastructure (Pages, Workers, D1 DBs, Durable Objects).
3. Concrete Code Features & Solves Completed.
</RULE[AGENTS.md]>


<RULE[AGENTS.md]>
**Cloudflare Billing Emergency & Telemetry Invariant:**
When investigating runaway Cloudflare usage, unknown billing draws, or massive AI token spikes (e.g., Regular Twitch Neurons / RTN):
1. **DO NOT** blindly attempt to `wrangler tail` multiple projects. This is too slow and prone to WebSocket timeouts during emergencies.
2. **MANDATORY ACTION**: Immediately execute the Cloudflare Telemetry sweep script (`C:\Users\John\.gemini\config\skills\cloudflare-telemetry\scripts\query_cf.ps1`) to generate the `dashboard.html` report.
3. Read the generated HTML dashboard and specifically check for anomalous **D1 Database file sizes** (runaway loops instantly bloat their ledger DBs) and **Recent Deployment Timestamps** to instantly isolate the offending project.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Operator Identity & Product Vision Invariant:**
John Dondlinger is an advanced Edge Architect building globally scalable consumer SaaS, AI platforms, and MMOs (e.g., InspectaLlama, Heckler) using Zero-Liability Architecture (ZLA), Cloudflare Workers, Durable Objects, D1, and Blazor WASM.

1. NEVER treat his projects as generic local web-dev agency builds or B2B brochure sites for small businesses.
2. When explicitly asked about monetization, pricing, or career trajectory, focus EXCLUSIVELY on high-leverage outcomes: 
   - Solo Founder SaaS models (Stripe subscriptions, premium consumer micro-transactions).
   - Top-tier remote Edge Architect/Senior Engineer roles.
3. NEVER propose pitching his advanced edge software as standard agency retainers to local brick-and-mortar businesses unless he explicitly requests a B2B agency workflow.
</RULE[AGENTS.md]>


<RULE[AGENTS.md]>
**OrchestratorDO / `>>` Shorthand Dispatch (MCP Migration):**
When the user types `>> [prompt]` or requests to evaluate something on the Edge, the agent MUST use the `call_mcp_tool` with ServerName: `orchestrator-do-mcp-server` and ToolName: `orchestrator_chat`. 
Do NOT use the legacy `orchestrator-do-dispatcher` subagent or raw PowerShell scripts. The native MCP server automatically handles DPAPI auth and anti-fluff guardrails with zero UI friction.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
**Durable Object Broadcast & Mobile HTTP Cache-Busting Invariant:**
When building live broadcast or real-time state APIs on Cloudflare Workers and Durable Objects:
1. **Mobile HTTP Cache-Busting**: ALL polling GET endpoints (e.g. `/api/stage/live`) MUST set strict anti-caching headers (`Cache-Control: no-store, no-cache, must-revalidate, max-age=0`) AND append a client-side timestamp parameter (`?_t=Date.now()`) to prevent mobile browsers (Safari/Chrome) from serving stale cached responses.
2. **Text-Level Deduplication**: DO state history MUST track normalized content strings (e.g., `LOWER(TRIM(text))`), not just entity UUID `id`s. SQL queries selecting fallback sets MUST use `GROUP BY LOWER(TRIM(text))` to prevent duplicate seed rows from re-playing.
3. **HTTP Heartbeat Listener Tracking**: For platforms supporting non-WebSocket HTTP clients, track active listener sessions via a `clientId` parameter mapped to sliding timestamp heartbeats in DO memory rather than relying solely on `this.ctx.getWebSockets().length`.
</RULE[AGENTS.md]>

<