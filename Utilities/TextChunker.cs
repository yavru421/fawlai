using System;
using System.Collections.Generic;
using FawlAI.Services;

namespace FawlAI.Utilities;

/// <summary>
/// Map-Reduce utility for splitting large text inputs into edge-inference-safe payload chunks.
/// No chunk produced by <see cref="Chunk"/> will exceed <c>maxChunkSize</c> characters.
/// </summary>
public static class TextChunker
{
    /// <summary>
    /// Splits <paramref name="input"/> into a list of chunks, each no longer than
    /// <paramref name="maxChunkSize"/> characters. Split preference order:
    /// <list type="number">
    ///   <item>Paragraph boundary (<c>\n\n</c>)</item>
    ///   <item>Sentence boundary (<c>". "</c>)</item>
    ///   <item>Hard cut at <paramref name="maxChunkSize"/></item>
    /// </list>
    /// </summary>
    /// <param name="input">The raw text to chunk.</param>
    /// <param name="maxChunkSize">Maximum characters per chunk. Default: 3000.</param>
    public static IReadOnlyList<string> Chunk(string input, int maxChunkSize = 3000)
    {
        if (string.IsNullOrEmpty(input))
            return Array.Empty<string>();

        var chunks = new List<string>();
        var remaining = input;

        while (remaining.Length > maxChunkSize)
        {
            int splitAt = FindSplitPoint(remaining, maxChunkSize);
            chunks.Add(remaining[..splitAt].Trim());
            remaining = remaining[splitAt..].TrimStart();
        }

        if (!string.IsNullOrWhiteSpace(remaining))
            chunks.Add(remaining.Trim());

        return chunks;
    }

    /// <summary>
    /// Maps a list of text chunks to <see cref="InferencePayload"/> objects, ready for
    /// fan-out dispatch via <c>EdgeInferenceOrchestrator.FanOutAsync</c>.
    /// Each payload carries its <c>ChunkIndex</c> and <c>TotalChunks</c> for ordered reduce.
    /// </summary>
    /// <param name="chunks">The list of text chunks returned by <see cref="Chunk"/>.</param>
    /// <param name="taskType">The inference task type to assign to each payload. Default: "summarize".</param>
    public static InferencePayload[] ToPayloads(IReadOnlyList<string> chunks, string taskType = "summarize")
    {
        var payloads = new InferencePayload[chunks.Count];
        for (int i = 0; i < chunks.Count; i++)
            payloads[i] = new InferencePayload(taskType, chunks[i], i, chunks.Count);
        return payloads;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private static int FindSplitPoint(string text, int maxLen)
    {
        // 1. Prefer paragraph boundary
        int idx = text.LastIndexOf("\n\n", maxLen, StringComparison.Ordinal);
        if (idx > 0) return idx + 2;

        // 2. Prefer sentence boundary
        idx = text.LastIndexOf(". ", maxLen, StringComparison.Ordinal);
        if (idx > 0) return idx + 2;

        // 3. Hard cut
        return maxLen;
    }
}
