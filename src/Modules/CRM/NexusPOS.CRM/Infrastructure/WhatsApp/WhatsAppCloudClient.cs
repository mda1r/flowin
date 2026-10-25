using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using NexusPOS.CRM.Domain.Marketing;

namespace NexusPOS.CRM.Infrastructure.WhatsApp;

public sealed record WhatsAppSendResult(bool Ok, string? MessageId, string? Error);

// Talks to Meta's WhatsApp Cloud API with the store's own number and token.
public interface IWhatsAppSender
{
    Task<WhatsAppSendResult> UploadImageAsync(WhatsAppSettings settings, MarketingMedia image, CancellationToken ct);

    Task<WhatsAppSendResult> SendTemplateAsync(
        WhatsAppSettings settings, string phone, string name, string message, string? mediaId, CancellationToken ct);
}

internal sealed partial class WhatsAppCloudClient(HttpClient http, IConfiguration configuration) : IWhatsAppSender
{
    private string Version => configuration["WhatsApp:GraphApiVersion"] ?? "v23.0";

    public async Task<WhatsAppSendResult> UploadImageAsync(WhatsAppSettings settings, MarketingMedia image, CancellationToken ct)
    {
        ByteArrayContent file = new(image.Data);
        file.Headers.ContentType = new MediaTypeHeaderValue(image.ContentType);
        using MultipartFormDataContent form = new()
        {
            { new StringContent("whatsapp"), "messaging_product" },
            { new StringContent(image.ContentType), "type" },
            { file, "file", "offer" + Extension(image.ContentType) },
        };

        using HttpRequestMessage request = new(HttpMethod.Post, $"{Version}/{settings.PhoneNumberId}/media") { Content = form };
        return await SendAsync(request, settings, "id", ct);
    }

    public async Task<WhatsAppSendResult> SendTemplateAsync(
        WhatsAppSettings settings, string phone, string name, string message, string? mediaId, CancellationToken ct)
    {
        object payload = BuildTemplatePayload(settings, phone, name, message, mediaId);
        // A fixed-length body rather than a streamed one, which every proxy and gateway accepts.
        using HttpRequestMessage request = new(HttpMethod.Post, $"{Version}/{settings.PhoneNumberId}/messages")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        return await SendAsync(request, settings, "messages", ct);
    }

    // Template variables may not contain line breaks, tabs or more than four spaces in a row.
    internal static string ToTemplateText(string text)
    {
        string oneLine = LineBreaks().Replace(text.Trim(), " · ");
        return Spaces().Replace(oneLine, " ");
    }

    internal static object BuildTemplatePayload(
        WhatsAppSettings settings, string phone, string name, string message, string? mediaId)
    {
        List<object> bodyParams = [];
        if (settings.IncludeNameVariable)
        {
            bodyParams.Add(new { type = "text", text = ToTemplateText(name) });
        }

        bodyParams.Add(new { type = "text", text = ToTemplateText(message) });

        List<object> components = [];
        if (settings.HasImageHeader && mediaId is not null)
        {
            components.Add(new { type = "header", parameters = new object[] { new { type = "image", image = new { id = mediaId } } } });
        }

        components.Add(new { type = "body", parameters = bodyParams });

        return new
        {
            messaging_product = "whatsapp",
            to = phone,
            type = "template",
            template = new { name = settings.TemplateName, language = new { code = settings.LanguageCode }, components },
        };
    }

    private async Task<WhatsAppSendResult> SendAsync(
        HttpRequestMessage request, WhatsAppSettings settings, string idField, CancellationToken ct)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.AccessToken);
        try
        {
            using HttpResponseMessage response = await http.SendAsync(request, ct);
            string body = await response.Content.ReadAsStringAsync(ct);
            using JsonDocument json = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
            JsonElement root = json.RootElement;

            if (response.IsSuccessStatusCode)
            {
                string? id = idField == "messages"
                    ? root.TryGetProperty("messages", out JsonElement msgs) && msgs.GetArrayLength() > 0 ? msgs[0].GetProperty("id").GetString() : null
                    : root.TryGetProperty("id", out JsonElement idEl) ? idEl.GetString() : null;
                return new WhatsAppSendResult(true, id, null);
            }

            string error = root.TryGetProperty("error", out JsonElement err) && err.TryGetProperty("message", out JsonElement m)
                ? m.GetString() ?? response.ReasonPhrase ?? "error"
                : $"HTTP {(int)response.StatusCode}";
            return new WhatsAppSendResult(false, null, error);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new WhatsAppSendResult(false, null, "تعذّر الاتصال بواتساب: " + (ex.InnerException?.Message ?? ex.Message));
        }
    }

    private static string Extension(string contentType) => contentType switch
    {
        "image/png" => ".png",
        "image/webp" => ".webp",
        _ => ".jpg",
    };

    [GeneratedRegex(@"\s*[\r\n\t]+\s*")]
    private static partial Regex LineBreaks();

    [GeneratedRegex(@" {2,}")]
    private static partial Regex Spaces();
}
