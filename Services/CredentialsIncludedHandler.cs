using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Components.WebAssembly.Http;

namespace FawlAI.Services;

/// <summary>
/// HTTP message handler that sets <see cref="BrowserRequestCredentials.Include"/> on every
/// outbound request. This instructs the browser's <c>fetch</c> API to attach the
/// Cloudflare Access Zero Trust HTTP-only cookie automatically.
/// <para>
/// No API keys, tokens, or secrets are injected here.
/// The network perimeter is enforced entirely by Cloudflare Zero Trust.
/// </para>
/// </summary>
public sealed class CredentialsIncludedHandler : DelegatingHandler
{
    /// <inheritdoc/>
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        request.SetBrowserRequestCredentials(BrowserRequestCredentials.Include);
        return base.SendAsync(request, cancellationToken);
    }
}
