# AmpliLoop Beat Studio - Blazor PWA Context Memory

## Project Architecture
- **Framework:** Blazor WebAssembly (WASM) Progressive Web App (PWA)
- **Compilation:** Ahead-of-Time (AOT) compilation enabled (`RunAOTCompilation=true`, `WasmStripILAfterAOT=true`).
- **Deployment:** Cloudflare Workers/Pages via Wrangler, using the `build.sh` script.

## Core Architectural Constraints (iOS Safari Specific)
- **Memory (Jetsam Crashes):** iOS Safari aggressively terminates tabs using too much RAM. `EmccMaximumHeapSize` MUST be strictly capped at `268435456` (256MB) in the `.csproj`.
- **Storage Quota (50MB Limit):** iOS caps PWA storage aggressively. `BlazorCacheBootResources` MUST be `false` in `.csproj` to prevent the default framework behavior from double-caching `.dll` and `.wasm` files.
- **Service Worker SPA Fix:** The custom `service-worker.published.js` must clone and strip the `redirected = true` flag from fetched assets before caching them to prevent Cloudflare/SPA routing errors. It must also implement `self.skipWaiting()` and `clients.claim()` for instantaneous PWA updates.

## Critical Technical Workarounds
- **AOT Build Pipelines:** Because AOT requires the Emscripten C++ toolchain, remote build environments (like Cloudflare) must explicitly execute `./dotnet/dotnet workload restore` before `dotnet publish` in the `build.sh` script to install `wasm-tools`.
- **Web Audio API (AudioContext) on iOS:** Safari's rigid security policies reject AudioContext activation/resumption if the call crosses an asynchronous bridge. You CANNOT initialize or resume audio using Blazor C# JSInterop (e.g., `JSRuntime.InvokeVoidAsync`). It MUST be done synchronously via a native Javascript DOM event (e.g., `onclick="window.audioCtx.resume();"` directly on the parent HTML tag).
- **Mobile Viewport & Touch UI:** Always use `100dvh` (not `100vh`) to prevent Safari's address bar from squishing the UI. Apply `overscroll-behavior-y: none;` instead of `overflow: hidden` to the body to prevent pull-to-refresh without breaking internal scrolling. Use `-webkit-tap-highlight-color: transparent` and `user-select: none` to strip native iOS browser tap artifacts.
