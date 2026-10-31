using System.Globalization;
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
    internal const int MaxLineQuantity = 50;
    private const int MaxHistoryTurns = 30;
    private const int MaxTurnLength = 2000;
    private const int MaxCartLines = 50;

    private const string SystemPromptTemplate = """
        أنت "سعد"، كاشير ذكي ودود في مقهى. تتحدث العربية فقط.

        مهمتك:
        ١. عند أول رسالة، رحّب بالعميل باسمك "سعد" وأسأله عن طلبه
        ٢. خذ الطلب، وضّح ما تم إضافته، وأسأل "ايش ثاني؟"
        ٣. عند انتهاء الطلب، لخّص الطلب واذكر الإجمالي واسأل "كاش ولا شبكة؟"
        ٤. بعد تحديد طريقة الدفع، شكّره وأكمل الطلب

        قائمة المنتجات المتاحة (الأسعار شاملة ضريبة القيمة المضافة 15%):
        {MENU}

        السلة الحالية على شاشة الكاشير (قبل تنفيذ إجراءات ردك هذا):
        {CART}

        قواعد مهمة:
        - رد بـ JSON صالح فقط، لا تكتب أي شيء خارج الـ JSON
        - الرسائل قصيرة وطبيعية (جملة واحدة أو جملتان)
        - استخدم variantId الدقيق من القائمة أعلاه، ولا تخترع أي معرّف
        - السلة أعلاه هي الحقيقة: لا تضف صنفاً موجوداً مرة ثانية إلا إذا طلب العميل زيادة
        - لتغيير الكمية استخدم set_quantity، ولحذف صنف استخدم remove_item
        - عند ذكر الإجمالي اذكر إجمالي السلة أعلاه كما هو (شامل الضريبة) ولا تحسبه بنفسك
        - لا تذكر رقم الإجمالي في رد يضيف أو يعدّل أصنافاً، اذكره في الملخص فقط
        - لا تستخدم complete_order إلا بعد أن يحدد العميل طريقة الدفع والسلة غير فارغة
        - إذا طلب العميل شيئاً غير موجود، أخبره بلطف

        شكل الرد (JSON فقط، لا شيء آخر):
        {
          "message": "النص الذي ستقوله للعميل",
          "actions": [],
          "state": "greeting"
        }

        أنواع actions:
        - add_item: إضافة منتج {"type":"add_item","variantId":"UUID","quantity":1,"notes":""}
        - set_quantity: تعديل كمية صنف في السلة {"type":"set_quantity","variantId":"UUID","quantity":2}
        - remove_item: حذف صنف من السلة {"type":"remove_item","variantId":"UUID"}
        - complete_order: إتمام الدفع {"type":"complete_order","paymentMethod":"Cash"} أو "Card"

        قيم state الممكنة: greeting, taking_order, summarizing, payment_method, complete
        """;

    internal const string UnknownItemNote = "ما لقيت بعض الأصناف في القائمة، ممكن توضح اسمها؟";
    internal const string NotInCartNote = "هذا الصنف مو موجود في الطلب الحالي.";
    internal const string BadQuantityNote = "ما فهمت الكمية، كم تبي بالضبط؟";
    internal const string EmptyCartNote = "الطلب فاضي، وش تحب تطلب؟";
    internal const string PaymentMethodNote = "كاش ولا شبكة؟";

    public async Task<ErrorOr<AiCashierResponse>> Handle(
        AiCashierCommand request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<AiMenuItem> menu = await LoadMenuAsync(cancellationToken);
        IReadOnlyList<AiCashierCartLine> cart = SanitizeCart(request.Cart, menu);

        string systemPrompt = SystemPromptTemplate
            .Replace("{MENU}", FormatMenu(menu))
            .Replace("{CART}", FormatCart(cart, request.CartTotal));

        IReadOnlyList<ClaudeMessage> messages = BuildConversation(request.Messages);

        string rawResponse = await claude.ChatWithHistoryAsync(systemPrompt, messages, cancellationToken);

        return ValidateActions(ParseResponse(rawResponse), menu, cart);
    }

    internal sealed record AiMenuItem(Guid VariantId, string Name, decimal Price);

    private async Task<IReadOnlyList<AiMenuItem>> LoadMenuAsync(CancellationToken ct)
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

        return [.. variants
            .Where(v => products.ContainsKey(v.ProductId))
            .Select(v =>
            {
                var product = products[v.ProductId];
                string display = string.Equals(v.Name, product.Name, StringComparison.OrdinalIgnoreCase)
                    ? product.Name
                    : $"{product.Name} - {v.Name}";
                return new AiMenuItem(v.Id.Value, display, v.SalePrice.Amount);
            })
            .OrderBy(m => m.Name)];
    }

    private static string FormatMenu(IReadOnlyList<AiMenuItem> menu) =>
        menu.Count > 0
            ? string.Join("\n", menu.Select(m =>
                $"- {m.Name}: {m.Price.ToString("F2", CultureInfo.InvariantCulture)} ر.س (variantId: {m.VariantId})"))
            : "لا توجد منتجات متاحة حالياً";

    // Keeps only well-formed lines; names come from the catalog when the variant is known
    // so free text from the client never reaches the prompt for menu items.
    internal static IReadOnlyList<AiCashierCartLine> SanitizeCart(
        IReadOnlyList<AiCashierCartLine>? cart,
        IReadOnlyList<AiMenuItem> menu)
    {
        if (cart is null || cart.Count == 0)
        {
            return [];
        }

        var menuById = menu.ToDictionary(m => m.VariantId);
        var lines = new List<AiCashierCartLine>();
        foreach (AiCashierCartLine line in cart.Take(MaxCartLines))
        {
            if (!Guid.TryParse(line.VariantId, out Guid id) || line.Quantity <= 0)
            {
                continue;
            }

            string name = menuById.TryGetValue(id, out AiMenuItem? item) ? item.Name : CleanText(line.Name, 80);
            lines.Add(new AiCashierCartLine(id.ToString(), name, line.Quantity, Math.Max(0, line.LineTotal)));
        }

        return lines;
    }

    private static string FormatCart(IReadOnlyList<AiCashierCartLine> cart, decimal? cartTotal)
    {
        if (cart.Count == 0)
        {
            return "السلة فارغة";
        }

        decimal total = cartTotal is > 0 ? cartTotal.Value : cart.Sum(l => l.LineTotal);
        var lines = cart.Select(l =>
            $"- {l.Name} × {l.Quantity.ToString("0.##", CultureInfo.InvariantCulture)} = {l.LineTotal.ToString("F2", CultureInfo.InvariantCulture)} ر.س (variantId: {l.VariantId})");
        return string.Join("\n", lines) + $"\nإجمالي السلة شامل الضريبة: {total.ToString("F2", CultureInfo.InvariantCulture)} ر.س";
    }

    // Anthropic expects the conversation to open with a user turn and alternate roles.
    internal static IReadOnlyList<ClaudeMessage> BuildConversation(IReadOnlyList<ClaudeMessage>? history)
    {
        var turns = (history ?? [])
            .Where(m => !string.IsNullOrWhiteSpace(m.Content) && (m.Role is "user" or "assistant"))
            .TakeLast(MaxHistoryTurns)
            .Select(m => new ClaudeMessage(m.Role, CleanText(m.Content, MaxTurnLength)))
            .ToList();

        if (turns.Count == 0 || turns[0].Role != "user")
        {
            turns.Insert(0, new ClaudeMessage("user", "ابدأ"));
        }

        var merged = new List<ClaudeMessage>();
        foreach (ClaudeMessage turn in turns)
        {
            if (merged.Count > 0 && merged[^1].Role == turn.Role)
            {
                merged[^1] = merged[^1] with { Content = $"{merged[^1].Content}\n{turn.Content}" };
            }
            else
            {
                merged.Add(turn);
            }
        }

        return merged;
    }

    // Drops actions the POS cannot honour (made-up ids, items not in the cart, odd quantities,
    // paying an empty order) and tells the customer instead of pretending it worked.
    internal static AiCashierResponse ValidateActions(
        AiCashierResponse response,
        IReadOnlyList<AiMenuItem> menu,
        IReadOnlyList<AiCashierCartLine> cart)
    {
        var menuIds = menu.Select(m => m.VariantId).ToHashSet();
        var projected = new Dictionary<Guid, decimal>();
        foreach (AiCashierCartLine line in cart)
        {
            if (Guid.TryParse(line.VariantId, out Guid id))
            {
                projected[id] = projected.GetValueOrDefault(id) + line.Quantity;
            }
        }

        var itemActions = new List<AiCashierAction>();
        AiCashierAction? completion = null;
        var notes = new List<string>();
        bool itemDropped = false;
        bool completionDropped = false;

        void Note(string note)
        {
            if (!notes.Contains(note))
            {
                notes.Add(note);
            }
        }

        foreach (AiCashierAction action in response.Actions)
        {
            string type = action.Type.Trim().ToLowerInvariant();
            bool hasId = Guid.TryParse(action.VariantId, out Guid id);
            bool wholeQty = action.Quantity == decimal.Truncate(action.Quantity);

            switch (type)
            {
                case "add_item":
                    if (!hasId || !menuIds.Contains(id))
                    {
                        itemDropped = true;
                        Note(UnknownItemNote);
                    }
                    else if (!wholeQty || action.Quantity <= 0 || projected.GetValueOrDefault(id) + action.Quantity > MaxLineQuantity)
                    {
                        itemDropped = true;
                        Note(BadQuantityNote);
                    }
                    else
                    {
                        string? notesText = string.IsNullOrWhiteSpace(action.Notes) ? null : CleanText(action.Notes, 100);
                        itemActions.Add(new AiCashierAction("add_item", id.ToString(), action.Quantity, notesText));
                        projected[id] = projected.GetValueOrDefault(id) + action.Quantity;
                    }

                    break;

                case "remove_item":
                    if (!hasId || !projected.ContainsKey(id))
                    {
                        itemDropped = true;
                        Note(NotInCartNote);
                    }
                    else
                    {
                        itemActions.Add(new AiCashierAction("remove_item", id.ToString(), 0));
                        projected.Remove(id);
                    }

                    break;

                case "set_quantity":
                    if (!hasId || (!projected.ContainsKey(id) && !menuIds.Contains(id)))
                    {
                        itemDropped = true;
                        Note(projected.Count > 0 ? NotInCartNote : UnknownItemNote);
                    }
                    else if (!wholeQty || action.Quantity < 0 || action.Quantity > MaxLineQuantity)
                    {
                        itemDropped = true;
                        Note(BadQuantityNote);
                    }
                    else if (action.Quantity == 0)
                    {
                        if (projected.Remove(id))
                        {
                            itemActions.Add(new AiCashierAction("remove_item", id.ToString(), 0));
                        }
                    }
                    else if (!projected.ContainsKey(id))
                    {
                        // Setting a quantity of something not yet ordered means adding it.
                        itemActions.Add(new AiCashierAction("add_item", id.ToString(), action.Quantity));
                        projected[id] = action.Quantity;
                    }
                    else
                    {
                        itemActions.Add(new AiCashierAction("set_quantity", id.ToString(), action.Quantity));
                        projected[id] = action.Quantity;
                    }

                    break;

                case "complete_order":
                    string? method = action.PaymentMethod?.Trim().ToLowerInvariant() switch
                    {
                        "cash" => "Cash",
                        "card" => "Card",
                        _ => null,
                    };
                    if (completion is not null)
                    {
                        break;
                    }

                    if (method is null)
                    {
                        completionDropped = true;
                        Note(PaymentMethodNote);
                    }
                    else
                    {
                        completion = new AiCashierAction("complete_order", PaymentMethod: method);
                    }

                    break;

                default:
                    // Unknown action types are ignored; they never touch the cart.
                    break;
            }
        }

        if (completion is not null)
        {
            if (projected.Values.All(q => q <= 0))
            {
                completion = null;
                completionDropped = true;
                Note(EmptyCartNote);
            }
            else if (itemDropped)
            {
                // Never take payment for an order the customer did not get exactly.
                completion = null;
                completionDropped = true;
            }
        }

        var actions = new List<AiCashierAction>(itemActions);
        if (completion is not null)
        {
            actions.Add(completion);
        }

        string message = notes.Count > 0
            ? $"{response.Message.TrimEnd()} {string.Join(" ", notes)}"
            : response.Message;

        // "complete" without a payment would stop the mic while the order is still open.
        string state = response.State;
        if (completionDropped || (state == "complete" && completion is null))
        {
            state = projected.Values.Any(q => q > 0) && !itemDropped ? "payment_method" : "taking_order";
        }

        return new AiCashierResponse(message, actions, state);
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

            string message = ReadString(root, "message") is { Length: > 0 } msg ? msg : "حياك الله!";
            string state = ReadString(root, "state") is { Length: > 0 } st ? st : "taking_order";

            var actions = new List<AiCashierAction>();
            if (root.TryGetProperty("actions", out JsonElement actionsEl)
                && actionsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement action in actionsEl.EnumerateArray())
                {
                    if (action.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    actions.Add(new AiCashierAction(
                        ReadString(action, "type") ?? "",
                        ReadString(action, "variantId"),
                        ReadDecimal(action, "quantity") ?? 1,
                        ReadString(action, "notes"),
                        ReadString(action, "paymentMethod")));
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

    private static string? ReadString(JsonElement obj, string name) =>
        obj.TryGetProperty(name, out JsonElement el)
            ? el.ValueKind switch
            {
                JsonValueKind.String => el.GetString(),
                JsonValueKind.Number => el.GetRawText(),
                _ => null,
            }
            : null;

    private static decimal? ReadDecimal(JsonElement obj, string name)
    {
        if (!obj.TryGetProperty(name, out JsonElement el))
        {
            return null;
        }

        if (el.ValueKind == JsonValueKind.Number && el.TryGetDecimal(out decimal number))
        {
            return number;
        }

        return el.ValueKind == JsonValueKind.String
            && decimal.TryParse(el.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out decimal parsed)
                ? parsed
                : null;
    }

    private static string CleanText(string? text, int maxLength)
    {
        string cleaned = (text ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ').Trim();
        return cleaned.Length <= maxLength ? cleaned : cleaned[..maxLength];
    }
}
