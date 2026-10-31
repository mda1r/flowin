using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.Sales.Infrastructure.Services;

internal sealed class ClaudeApiService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<ClaudeApiService> logger)
    : IClaudeApiService
{
    private const string AnthropicApiUrl = "https://api.anthropic.com/v1/messages";
    private const string ModelId = "claude-haiku-4-5-20251001";

    // Short replies shown to the user; the real cause goes to the log only.
    internal const string NotConfiguredReply = "المساعد الذكي غير مفعّل على الخادم بعد. تواصل مع الدعم لتفعيله.";
    internal const string UnavailableReply = "تعذّر الوصول إلى المساعد الآن، حاول بعد قليل.";
    internal const string EmptyReply = "لم يصل رد من المساعد، حاول مرة أخرى.";

    public Task<string> ChatAsync(string systemPrompt, string userMessage, CancellationToken ct = default) =>
        SendAsync(systemPrompt, [new ClaudeMessage("user", userMessage)], ct);

    public Task<string> ChatWithHistoryAsync(
        string systemPrompt,
        IReadOnlyList<ClaudeMessage> messages,
        CancellationToken ct = default) =>
        SendAsync(systemPrompt, messages, ct);

    private async Task<string> SendAsync(
        string systemPrompt,
        IReadOnlyList<ClaudeMessage> messages,
        CancellationToken ct)
    {
        string apiKey = configuration["Anthropic:ApiKey"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogWarning("Claude request skipped: Anthropic:ApiKey is not configured");
            return NotConfiguredReply;
        }

        using HttpClient client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("x-api-key", apiKey);
        client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var payload = new
        {
            model = ModelId,
            max_tokens = 1024,
            system = systemPrompt,
            messages = messages.Select(m => new { role = m.Role, content = m.Content }).ToArray(),
        };

        try
        {
            using HttpResponseMessage response = await client.PostAsJsonAsync(AnthropicApiUrl, payload, ct);

            if (!response.IsSuccessStatusCode)
            {
                string errorBody = await response.Content.ReadAsStringAsync(ct);
                logger.LogError(
                    "Claude API returned {StatusCode}: {ErrorBody}",
                    (int)response.StatusCode,
                    errorBody[..Math.Min(errorBody.Length, 1000)]);
                return UnavailableReply;
            }

            AnthropicResponse? result = await response.Content.ReadFromJsonAsync<AnthropicResponse>(ct);
            string? text = result?.Content?.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.Text))?.Text;
            return string.IsNullOrWhiteSpace(text) ? EmptyReply : text;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Claude API call failed");
            return UnavailableReply;
        }
    }

    private sealed record AnthropicResponse(
        [property: JsonPropertyName("content")] AnthropicContent[]? Content);

    private sealed record AnthropicContent(
        [property: JsonPropertyName("text")] string? Text);
}
