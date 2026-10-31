using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using NexusPOS.CRM.Domain.Marketing;

namespace NexusPOS.CRM.Infrastructure.WhatsApp;

public enum WhatsAppFailure
{
    None = 0,

    // Only this customer: mark them failed and carry on.
    Recipient = 1,

    // The account, token or template: everyone would fail the same way, so stop and keep them waiting.
    Campaign = 2,

    // No answer from Meta: the message may or may not have gone out.
    Connection = 3,
}

public sealed record WhatsAppSendResult(bool Ok, string? MessageId, string? Error, WhatsAppFailure Failure = WhatsAppFailure.None)
{
    public bool StopsCampaign => Failure is WhatsAppFailure.Campaign or WhatsAppFailure.Connection;
}

public enum WhatsAppCheckStatus
{
    Ok = 1,
    Warning = 2,
    Failed = 3,
}

public sealed record WhatsAppCheckItem(string Label, WhatsAppCheckStatus Status, string Detail);

public sealed record WhatsAppCheckResult(string? DisplayPhoneNumber, string? TemplateBody, IReadOnlyList<WhatsAppCheckItem> Items)
{
    public bool Ok => Items.All(i => i.Status != WhatsAppCheckStatus.Failed);
}

// Talks to Meta's WhatsApp Cloud API with the store's own number and token.
public interface IWhatsAppSender
{
    Task<WhatsAppSendResult> UploadImageAsync(WhatsAppSettings settings, MarketingMedia image, CancellationToken ct);

    Task<WhatsAppSendResult> SendTemplateAsync(
        WhatsAppSettings settings, string phone, string name, string message, string? mediaId, CancellationToken ct);

    // Reads the number and, when the business account id is known, the template, without sending anything.
    Task<WhatsAppCheckResult> CheckAsync(WhatsAppSettings settings, CancellationToken ct);
}

internal sealed partial class WhatsAppCloudClient(HttpClient http, IConfiguration configuration) : IWhatsAppSender
{
    private const string NumberLabel = "الرقم والتوكن";
    private const string TemplateLabel = "القالب";

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

    public async Task<WhatsAppCheckResult> CheckAsync(WhatsAppSettings settings, CancellationToken ct)
    {
        (JsonDocument? number, WhatsAppSendResult? numberError) = await GetJsonAsync(
            $"{Version}/{settings.PhoneNumberId}?fields=display_phone_number,verified_name,quality_rating", settings, ct);
        if (number is null)
        {
            return new WhatsAppCheckResult(null, null,
            [
                new(NumberLabel, WhatsAppCheckStatus.Failed, numberError?.Error ?? WhatsAppErrors.Connection),
                new(TemplateLabel, WhatsAppCheckStatus.Warning, "يُفحص بعد إصلاح الرقم والتوكن."),
            ]);
        }

        List<WhatsAppCheckItem> items = [];
        string? display;
        using (number)
        {
            JsonElement root = number.RootElement;
            display = Text(root, "display_phone_number");
            string? verifiedName = Text(root, "verified_name");
            string detail = string.Join(" · ", new[] { display, verifiedName }.Where(v => !string.IsNullOrWhiteSpace(v)));
            items.Add(Text(root, "quality_rating") == "RED"
                ? new(NumberLabel, WhatsAppCheckStatus.Warning, $"{detail} · جودة الرقم منخفضة لدى Meta، خفّف الإرسال.")
                : new(NumberLabel, WhatsAppCheckStatus.Ok, detail.Length > 0 ? detail : "متصل"));
        }

        if (settings.BusinessAccountId.Length == 0)
        {
            items.Add(new(TemplateLabel, WhatsAppCheckStatus.Warning, "أضف معرّف حساب واتساب للأعمال (WABA ID) ليُفحص القالب أيضاً."));
            return new WhatsAppCheckResult(display, null, items);
        }

        (JsonDocument? templates, WhatsAppSendResult? templatesError) = await GetJsonAsync(
            $"{Version}/{settings.BusinessAccountId}/message_templates?name={Uri.EscapeDataString(settings.TemplateName)}&limit=100",
            settings, ct);
        if (templates is null)
        {
            items.Add(new(TemplateLabel, WhatsAppCheckStatus.Warning,
                "تعذّرت قراءة القوالب: " + (templatesError?.Error ?? WhatsAppErrors.Connection)));
            return new WhatsAppCheckResult(display, null, items);
        }

        using (templates)
        {
            JsonElement data = templates.RootElement.TryGetProperty("data", out JsonElement d) && d.ValueKind == JsonValueKind.Array
                ? d
                : default;
            (WhatsAppCheckItem item, string? body) = AnalyzeTemplates(data, settings);
            items.Add(item);
            return new WhatsAppCheckResult(display, body, items);
        }
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

    // Compares the template Meta holds with what the platform will send: language, approval, image header,
    // and the number of {{n}} variables. Returns the body text so the campaign preview can show it.
    internal static (WhatsAppCheckItem Item, string? Body) AnalyzeTemplates(JsonElement data, WhatsAppSettings settings)
    {
        List<JsonElement> named = data.ValueKind == JsonValueKind.Array
            ? [.. data.EnumerateArray().Where(x => Text(x, "name") == settings.TemplateName)]
            : [];
        if (named.Count == 0)
        {
            return (Fail($"لا يوجد قالب باسم «{settings.TemplateName}» في حساب واتساب للأعمال."), null);
        }

        JsonElement? template = named.FirstOrDefault(x => Text(x, "language") == settings.LanguageCode) is { ValueKind: JsonValueKind.Object } match
            ? match
            : null;
        if (template is not JsonElement tpl)
        {
            string languages = string.Join("، ", named.Select(n => Text(n, "language")).Distinct());
            return (Fail($"القالب موجود بلغة {languages} وليس {settings.LanguageCode}، صحّح لغة القالب."), null);
        }

        string status = Text(tpl, "status") ?? string.Empty;
        if (status != "APPROVED")
        {
            return (Fail("القالب " + StatusText(status) + "، لا يمكن الإرسال به الآن."), null);
        }

        JsonElement[] components = tpl.TryGetProperty("components", out JsonElement c) && c.ValueKind == JsonValueKind.Array
            ? [.. c.EnumerateArray()]
            : [];
        JsonElement? header = Component(components, "HEADER");
        string? headerFormat = header is JsonElement h ? Text(h, "format") : null;
        string? body = Component(components, "BODY") is JsonElement b ? Text(b, "text") : null;

        if (settings.HasImageHeader && headerFormat != "IMAGE")
        {
            return (Fail("القالب بلا ترويسة صورة، ألغِ خيار الصورة في الإعدادات."), body);
        }

        if (!settings.HasImageHeader && headerFormat == "IMAGE")
        {
            return (Fail("القالب فيه ترويسة صورة، فعّل خيار الصورة في الإعدادات."), body);
        }

        if (headerFormat is "VIDEO" or "DOCUMENT" or "LOCATION" ||
            (header is JsonElement textHeader && (Text(textHeader, "text") ?? string.Empty).Contains("{{", StringComparison.Ordinal)))
        {
            return (Fail("ترويسة القالب فيها متغير أو ملف لا تدعمه المنصة، استخدم صورة أو نصاً ثابتاً."), body);
        }

        string[] variables = [.. Variables().Matches(body ?? string.Empty).Select(m => m.Groups[1].Value).Distinct()];
        if (variables.Any(v => !v.All(char.IsAsciiDigit)))
        {
            return (Fail("القالب يستخدم متغيرات بأسماء، استخدم {{1}} و{{2}} بدلاً منها."), body);
        }

        int expected = settings.IncludeNameVariable ? 2 : 1;
        if (variables.Length != expected)
        {
            string wanted = settings.IncludeNameVariable ? "متغيرين: {{1}} الاسم و{{2}} العرض" : "متغيراً واحداً {{1}} للعرض";
            return (Fail($"نص القالب فيه {variables.Length} متغير، والإعدادات تتوقع {wanted}."), body);
        }

        bool dynamicButton = Component(components, "BUTTONS") is JsonElement buttons &&
            buttons.TryGetProperty("buttons", out JsonElement list) && list.ValueKind == JsonValueKind.Array &&
            list.EnumerateArray().Any(btn => (Text(btn, "url") ?? string.Empty).Contains("{{", StringComparison.Ordinal));
        if (dynamicButton)
        {
            return (Fail("زر القالب فيه رابط متغير لا تدعمه المنصة، اجعل الرابط ثابتاً."), body);
        }

        string category = Text(tpl, "category") is "MARKETING" ? "تسويقي" : Text(tpl, "category") ?? string.Empty;
        return (new WhatsAppCheckItem(TemplateLabel, WhatsAppCheckStatus.Ok, $"معتمد{(category.Length > 0 ? " · " + category : string.Empty)}"), body);
    }

    private static WhatsAppCheckItem Fail(string detail) => new(TemplateLabel, WhatsAppCheckStatus.Failed, detail);

    // Meta's error body: {"error": {"code": 190, "error_subcode": 463, "message": "..."}}.
    internal static WhatsAppSendResult ParseError(int httpStatus, JsonElement root)
    {
        int? code = null;
        int? subcode = null;
        string? message = null;
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out JsonElement err) && err.ValueKind == JsonValueKind.Object)
        {
            code = Number(err, "code");
            subcode = Number(err, "error_subcode");
            message = err.TryGetProperty("error_data", out JsonElement data) && data.ValueKind == JsonValueKind.Object &&
                Text(data, "details") is string details
                ? details
                : Text(err, "message");
        }

        return WhatsAppErrors.Describe(httpStatus, code, subcode, message);
    }

    private async Task<(JsonDocument? Json, WhatsAppSendResult? Error)> GetJsonAsync(
        string url, WhatsAppSettings settings, CancellationToken ct)
    {
        using HttpRequestMessage request = new(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.AccessToken);
        try
        {
            using HttpResponseMessage response = await http.SendAsync(request, ct);
            string body = await response.Content.ReadAsStringAsync(ct);
            JsonDocument json = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
            if (response.IsSuccessStatusCode)
            {
                return (json, null);
            }

            using (json)
            {
                return (null, ParseError((int)response.StatusCode, json.RootElement));
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return (null, new WhatsAppSendResult(false, null, WhatsAppErrors.Connection, WhatsAppFailure.Connection));
        }
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

            return ParseError((int)response.StatusCode, root);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new WhatsAppSendResult(false, null, WhatsAppErrors.Connection, WhatsAppFailure.Connection);
        }
    }

    private static JsonElement? Component(JsonElement[] components, string type) =>
        components.FirstOrDefault(c => string.Equals(Text(c, "type"), type, StringComparison.OrdinalIgnoreCase)) is { ValueKind: JsonValueKind.Object } found
            ? found
            : null;

    private static string? Text(JsonElement element, string property) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out JsonElement value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static int? Number(JsonElement element, string property) =>
        element.TryGetProperty(property, out JsonElement value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out int n)
            ? n
            : null;

    private static string StatusText(string status) => status switch
    {
        "PENDING" or "IN_APPEAL" => "قيد المراجعة من Meta",
        "REJECTED" => "مرفوض من Meta",
        "PAUSED" => "موقوف مؤقتاً من Meta",
        "DISABLED" => "معطّل من Meta",
        _ => $"بحالة {status}",
    };

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

    [GeneratedRegex(@"\{\{\s*([^{}\s]+)\s*\}\}")]
    private static partial Regex Variables();
}
