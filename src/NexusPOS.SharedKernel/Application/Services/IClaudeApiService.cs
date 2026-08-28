namespace NexusPOS.SharedKernel.Application.Services;

public sealed record ClaudeMessage(string Role, string Content);

public interface IClaudeApiService
{
    Task<string> ChatAsync(string systemPrompt, string userMessage, CancellationToken ct = default);
    Task<string> ChatWithHistoryAsync(string systemPrompt, IReadOnlyList<ClaudeMessage> messages, CancellationToken ct = default);
}
