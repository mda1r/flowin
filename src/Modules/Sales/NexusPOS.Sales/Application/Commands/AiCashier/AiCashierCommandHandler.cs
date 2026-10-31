using System.Text.Json;
using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Commands.AiCashier;

internal sealed class AiCashierCommandHandler(
    IClaudeApiService claude,
    CatalogDbContext catalogDb)
    : ICommandHandler<AiCashierCommand, AiCashierResponse>
{
    private const string SystemPromptTemplate = """
        أنت "سعد"، كاشير ذكي ودود في مقهى. تتحدث العربية فقط.

        مهمتك:
        ١. عند أول رسالة، رحّب بالعميل باسمك "سعد" وأسأله عن طلبه
        ٢. خذ الطلب، وضّح ما تم إضافته، وأسأل "ايش ثاني؟"
        ٣. عند انتهاء الطلب، أخبره بأن الطلب جاهز واسأل "كاش ولا شبكة؟"
        ٤. بعد تحديد طريقة الدفع، شكّره وأكمل الطلب

        قائمة المنتجات المتاحة:
        {MENU}

        قواعد مهمة:
        - رد بـ JSON صالح فقط، لا تكتب أي شيء خارج الـ JSON
        - الرسائل قصيرة وطبيعية (جملة واحدة أو جملتان)
        - استخدم variantId الدقيق من القائمة أعلاه
        - إذا طلب العميل شيئاً غير موجود، أخبره بلطف

        شكل الرد (JSON فقط، لا شيء آخر):
        {
          "message": "النص الذي ستقوله للعميل",
          "actions": [],
          "state": "greeting"
        }

        أنواع actions:
        - add_item: إضافة منتج {"type":"add_item","variantId":"UUID","quantity":1,"notes":""}
        - complete_order: إتمام الدفع {"type":"complete_order","paymentMethod":"Cash"} أو "Card"

        قيم state الممكنة: greeting, taking_order, summarizing, payment_method, complete
        """;

    public async Task<ErrorOr<AiCashierResponse>> Handle(
        AiCashierCommand request,
        CancellationToken cancellationToken)
    {
        string menu = await BuildMenuAsync(cancellationToken);
        string systemPrompt = SystemPromptTemplate.Replace("{MENU}", menu);

        IReadOnlyList<ClaudeMessage> messages = request.Messages.Count == 0
            ? [new ClaudeMessage("user", "ابدأ")]
            : request.Messages;

        string rawResponse = await claude.ChatWithHistoryAsync(systemPrompt, messages, cancellationToken);

        return ParseResponse(rawResponse);
    }

    private async Task<string> BuildMenuAsync(CancellationToken ct)
    {
        var variants = await catalogDb.ProductVariants
            .Where(v => v.IsActive)
            .AsNoTracking()
            .ToListAsync(ct);

        var productIds = variants.Select(v => v.ProductId).Distinct().ToList();
        var products = await catalogDb.Products
            .Where(p => productIds.Contains(p.Id) && p.IsActive)
            .AsNoTracking()
            .ToDictionaryAsync(p => p.Id, ct);

        var lines = variants
            .Where(v => products.ContainsKey(v.ProductId))
            .Select(v =>
            {
                var product = products[v.ProductId];
                string display = string.Equals(v.Name, product.Name, StringComparison.OrdinalIgnoreCase)
                    ? product.Name
                    : $"{product.Name} - {v.Name}";
                return $"- {display}: {v.SalePrice.Amount:F2} ر.س (variantId: {v.Id.Value})";
            })
            .OrderBy(l => l)
            .ToList();

        return lines.Count > 0 ? string.Join("\n", lines) : "لا توجد منتجات متاحة حالياً";
    }

    internal static AiCashierResponse ParseResponse(string raw)
    {
        try
        {
            int start = raw.IndexOf('{');
            int end = raw.LastIndexOf('}');
            if (start >= 0 && end > start)
            {
                raw = raw[start..(end + 1)];
            }

            using JsonDocument doc = JsonDocument.Parse(raw);
            JsonElement root = doc.RootElement;

            string message = root.TryGetProperty("message", out JsonElement msgEl)
                ? msgEl.GetString() ?? "حياك الله!"
                : "حياك الله!";

            string state = root.TryGetProperty("state", out JsonElement stateEl)
                ? stateEl.GetString() ?? "taking_order"
                : "taking_order";

            var actions = new List<AiCashierAction>();
            if (root.TryGetProperty("actions", out JsonElement actionsEl)
                && actionsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement action in actionsEl.EnumerateArray())
                {
                    string type = action.TryGetProperty("type", out JsonElement typeEl)
                        ? typeEl.GetString() ?? ""
                        : "";
                    string? variantId = action.TryGetProperty("variantId", out JsonElement vidEl)
                        ? vidEl.GetString()
                        : null;
                    decimal quantity = action.TryGetProperty("quantity", out JsonElement qtyEl)
                        ? qtyEl.GetDecimal()
                        : 1;
                    string? notes = action.TryGetProperty("notes", out JsonElement notesEl)
                        ? notesEl.GetString()
                        : null;
                    string? paymentMethod = action.TryGetProperty("paymentMethod", out JsonElement pmEl)
                        ? pmEl.GetString()
                        : null;

                    actions.Add(new AiCashierAction(type, variantId, quantity, notes, paymentMethod));
                }
            }

            return new AiCashierResponse(message, actions, state);
        }
        catch
        {
            return new AiCashierResponse(
                "عذراً، حدث خطأ. هل تودّ تكرار طلبك؟",
                [],
                "taking_order");
        }
    }
}
