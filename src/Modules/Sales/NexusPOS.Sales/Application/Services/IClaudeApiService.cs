namespace NexusPOS.Sales.Application.Services;

public interface IClaudeApiService
{
    Task<string> ChatAsync(string systemPrompt, string userMessage, CancellationToken ct = default);
}
