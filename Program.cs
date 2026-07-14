using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using FawlAI;
using FawlAI.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// ── Legacy client (preserved) ─────────────────────────────────────────────────
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<BlazorLocalStorage>();

// ── Tier B Inference Pipeline ─────────────────────────────────────────────────

// 1. Credentials handler: tells the browser to attach the Cloudflare Access
//    Zero Trust HTTP-only cookie on every outbound request (no secrets injected here).
builder.Services.AddTransient<CredentialsIncludedHandler>();

// 2. Named HttpClient — base address resolves to the same Worker origin.
//    Credentials handler is the only handler; no auth headers are added.
builder.Services.AddHttpClient("InferenceClient", client =>
{
    client.BaseAddress = new Uri(builder.HostEnvironment.BaseAddress);
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
})
.AddHttpMessageHandler<CredentialsIncludedHandler>();

// 3. Scoped orchestrator — receives the named client via factory to ensure
//    CredentialsIncludedHandler is applied to every request it makes.
builder.Services.AddScoped<EdgeInferenceOrchestrator>(sp =>
{
    var factory = sp.GetRequiredService<IHttpClientFactory>();
    var http    = factory.CreateClient("InferenceClient");
    var logger  = sp.GetRequiredService<ILogger<EdgeInferenceOrchestrator>>();
    return new EdgeInferenceOrchestrator(http, logger);
});

// 4. Singleton conversation memory — one sliding window per browser session.
builder.Services.AddSingleton<ConversationStateService>();

await builder.Build().RunAsync();
