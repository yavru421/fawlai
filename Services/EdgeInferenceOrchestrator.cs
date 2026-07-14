using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace FawlAI.Services;

// ── Shared Records ─────────────────────────────────────────────────────────────

/// <summary>Payload sent to the edge inference endpoint for a single text chunk.</summary>
/// <param name="TaskType">Inference task type: lint, brainstorm, monitor, summarize, refactor.</param>
/// <param name="Prompt">The text content to process — must not exceed 3,000 characters.</param>
/// <param name="ChunkIndex">Zero-based index of this chunk in the original document.</param>
/// <param name="TotalChunks">Total number of chunks in the fan-out batch.</param>
public record InferencePayload(string TaskType, string Prompt, int ChunkIndex, int TotalChunks);

/// <summary>Result returned from the edge inference endpoint for a single chunk.</summary>
/// <param name="Result">The model's response text. Empty string on failure.</param>
/// <param name="IsError">True if this chunk's inference call failed.</param>
/// <param name="ErrorMessage">Human-readable failure reason. Null on success.</param>
/// <param name="ChunkIndex">Original chunk index for ordered reduce.</param>
public record InferenceResult(string Result, bool IsError, string? ErrorMessage, int ChunkIndex);

// ── Orchestrator ───────────────────────────────────────────────────────────────

/// <summary>
/// Coordinates Map-Reduce AI inference against the Cloudflare Worker edge router.
/// <para>
///   <b>Fan-out</b>: Dispatches all payloads concurrently via <c>Task.WhenAll</c>
///   to <c>POST /api/infer</c>. Individual chunk failures are caught and isolated —
///   they do not abort the batch.
/// </para>
/// <para>
///   <b>Reduce</b>: Concatenates all successful chunk results and submits a final
///   <c>summarize</c> call to synthesize a unified answer.
/// </para>
/// The Worker remains entirely stateless — no session ID, no D1, no KV is used here.
/// </summary>
public sealed class EdgeInferenceOrchestrator
{
    private const string InferEndpoint = "/api/infer";

    private readonly HttpClient _http;
    private readonly ILogger<EdgeInferenceOrchestrator> _logger;

    /// <param name="http">
    /// Pre-configured <see cref="HttpClient"/> with base address set to the Worker origin
    /// and <c>BrowserRequestCredentials.Include</c> applied via <see cref="CredentialsIncludedHandler"/>.
    /// Do NOT configure credentials or auth headers here.
    /// </param>
    /// <param name="logger">Injected logger for per-chunk failure diagnostics.</param>
    public EdgeInferenceOrchestrator(HttpClient http, ILogger<EdgeInferenceOrchestrator> logger)
    {
        _http = http;
        _logger = logger;
    }

    /// <summary>
    /// Dispatches all <paramref name="payloads"/> concurrently using <c>Task.WhenAll</c>.
    /// Each chunk is sent independently to <c>POST /api/infer</c>.
    /// Failures are logged and returned as <see cref="InferenceResult"/> with <c>IsError = true</c>.
    /// </summary>
    /// <param name="payloads">The list of chunk payloads produced by <c>TextChunker.ToPayloads</c>.</param>
    /// <param name="ct">Cancellation token propagated to all concurrent requests.</param>
    /// <returns>Results sorted by <c>ChunkIndex</c> (original chunk order guaranteed).</returns>
    public async Task<IReadOnlyList<InferenceResult>> FanOutAsync(
        IReadOnlyList<InferencePayload> payloads,
        CancellationToken ct = default)
    {
        var tasks = payloads
            .Select(payload => InferSingleAsync(payload, ct))
            .ToArray();

        var results = await Task.WhenAll(tasks);

        // Guarantee original chunk order regardless of completion order
        return results.OrderBy(r => r.ChunkIndex).ToList();
    }

    /// <summary>
    /// Reduces all successful <paramref name="results"/> into a single synthesized answer.
    /// Joins chunk results with a separator and sends a final <c>summarize</c> call to the edge router.
    /// Falls back to the concatenated raw text if the reduce call fails.
    /// </summary>
    /// <param name="results">The ordered list of results from <see cref="FanOutAsync"/>.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The synthesized answer string, or raw concatenation on reduce failure.</returns>
    public async Task<string> ReduceAsync(
        IReadOnlyList<InferenceResult> results,
        CancellationToken ct = default)
    {
        var combined = string.Join(
            "\n\n---\n\n",
            results
                .Where(r => !r.IsError)
                .OrderBy(r => r.ChunkIndex)
                .Select(r => r.Result));

        if (string.IsNullOrWhiteSpace(combined))
            return string.Empty;

        // Single reduce call: summarize all chunk results into one answer
        var reducePayload = new InferencePayload("summarize", combined, 0, 1);
        var final = await InferSingleAsync(reducePayload, ct);

        return final.IsError ? combined : final.Result;
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private async Task<InferenceResult> InferSingleAsync(InferencePayload payload, CancellationToken ct)
    {
        try
        {
            using var response = await _http.PostAsJsonAsync(InferEndpoint, payload, ct);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<InferenceResult>(cancellationToken: ct);
            return result
                ?? new InferenceResult(string.Empty, true, "Null response from edge router.", payload.ChunkIndex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Edge inference failed for chunk {Index}/{Total}: {Message}",
                payload.ChunkIndex, payload.TotalChunks, ex.Message);
            return new InferenceResult(string.Empty, true, ex.Message, payload.ChunkIndex);
        }
    }
}
