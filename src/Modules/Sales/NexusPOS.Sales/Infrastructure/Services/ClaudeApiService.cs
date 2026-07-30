using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using NexusPOS.Sales.Application.Services;

namespace NexusPOS.Sales.Infrastructure.Services;

internal sealed class ClaudeApiService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    : IClaudeApiService
{
    private const string AnthropicApiUrl = "https://api.anthropic.com/v1/messages";
    private const string ModelId = "claude-haiku-4-5-20251001";

    public async Task<string> ChatAsync(string systemPrompt, string userMessage, CancellationToken ct = default)
    {
        string apiKey = configuration["Anthropic:ApiKey"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return "AI assistant is not configured. Please set the Anthropic:ApiKey in configuration.";
        }

        using HttpClient client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("x-api-key", apiKey);
        client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var payload = new
        {
            model = ModelId,
            max_tokens = 1024,
            system = systemPrompt,
            messages = new[] { new { role = "user", content = userMessage } },
        };

        HttpResponseMessage response = await client.PostAsJsonAsync(AnthropicApiUrl, payload, ct);

        if (!response.IsSuccessStatusCode)
        {
            return "Failed to get AI response. Please try again.";
        }

        AnthropicResponse? result = await response.Content.ReadFromJsonAsync<AnthropicResponse>(ct);
        return result?.Content?[0]?.Text ?? string.Empty;
    }

    private sealed record AnthropicResponse(
        [property: JsonPropertyName("content")] AnthropicContent[]? Content);

    private sealed record AnthropicContent(
        [property: JsonPropertyName("text")] string? Text);
}
