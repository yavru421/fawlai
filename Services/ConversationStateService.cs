using System;
using System.Collections.Generic;

namespace FawlAI.Services;

/// <summary>Represents a single message in a conversation exchange.</summary>
/// <param name="Role">The message role: "user", "assistant", or "system".</param>
/// <param name="Content">The raw text content of the message.</param>
/// <param name="Timestamp">UTC timestamp when the message was created.</param>
public record ChatMessage(string Role, string Content, DateTime Timestamp);

/// <summary>
/// Manages a sliding window of the last 5 conversation messages to cap token burn.
/// Registered as a Singleton — one window per browser session.
/// Thread-safe via internal lock.
/// </summary>
public sealed class ConversationStateService
{
    private readonly object _lock = new();
    private readonly LinkedList<ChatMessage> _window = new();
    private const int MaxWindowSize = 5;

    /// <summary>
    /// Adds a message to the sliding window.
    /// If the window already contains 5 messages, the oldest is evicted before adding the new one.
    /// </summary>
    /// <param name="msg">The message to add.</param>
    public void AddMessage(ChatMessage msg)
    {
        lock (_lock)
        {
            _window.AddLast(msg);
            if (_window.Count > MaxWindowSize)
                _window.RemoveFirst();
        }
    }

    /// <summary>
    /// Returns the current sliding window contents in chronological order (oldest → newest).
    /// </summary>
    public IReadOnlyList<ChatMessage> GetWindow()
    {
        lock (_lock)
            return new List<ChatMessage>(_window);
    }

    /// <summary>Clears all messages from the window, resetting conversation state.</summary>
    public void Clear()
    {
        lock (_lock)
            _window.Clear();
    }

    /// <summary>
    /// Rough token estimate for all messages currently in the window.
    /// Computed as <c>Content.Length / 4</c> per message (standard GPT-style approximation).
    /// </summary>
    public int TokenEstimate
    {
        get
        {
            lock (_lock)
            {
                int total = 0;
                foreach (var msg in _window)
                    total += msg.Content.Length / 4;
                return total;
            }
        }
    }
}
