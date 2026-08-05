using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.Sales.Application.Services;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Commands.AiChat;

internal sealed class AiChatCommandHandler(
    IClaudeApiService claude,
    ISalesSummaryRepository summaryRepository,
    ISaleRecordRepository saleRecordRepository,
    PosDbContext posDb,
    CatalogDbContext catalogDb,
    InventoryDbContext inventoryDb)
    : ICommandHandler<AiChatCommand, string>
{
    private const string SystemPrompt = """
        أنت "سعد"، المساعد الذكي المدمج في نظام Flowin POS. أنت في آنٍ واحد:
        - محاسب: تحلل الإيرادات والمصاريف والضرائب وتكشف الفروقات المالية
        - مدير مبيعات: تتابع الأداء اليومي وتقارنه بالمعدلات السابقة وتحدد نقاط القوة والضعف
        - مستشار تسويق: تقترح عروض وأوقات ذروة وتكتيكات لزيادة المبيعات بناءً على البيانات الفعلية

        قواعد الرد الإلزامية:
        - اكتب بالعربية دائماً
        - لا تستخدم علامات markdown أبداً: ممنوع # أو ** أو * أو — كعلامات تنسيق
        - اكتب فقرات نصية عادية أو أرقام مرقمة (١ ٢ ٣)
        - كن مباشراً وعملياً، لا تقدم نفسك في كل رد
        - اذكر الأرقام بدقة واقترح إجراءً محدداً
        - إذا سُئلت عن شيء غير متوفر في البيانات، قل ذلك بجملة واحدة
        """;

    public async Task<ErrorOr<string>> Handle(AiChatCommand request, CancellationToken cancellationToken)
    {
        string context;
        try
        {
            context = await BuildContextAsync(request.BranchId, cancellationToken);
        }
        catch
        {
            context = "لا توجد بيانات متاحة حالياً.";
        }

        string fullMessage = $"{context}\n\nسؤال المستخدم: {request.Message}";

        string response = await claude.ChatAsync(SystemPrompt, fullMessage, cancellationToken);
        return response;
    }

    private async Task<string> BuildContextAsync(Guid branchId, CancellationToken ct)
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        DateTime now = DateTime.UtcNow;
        DateTime thirtyDaysAgo = now.AddDays(-30);
        DateTime sevenDaysAgo = now.AddDays(-7);

        var sections = new List<string>();

        // ── 1. Daily sales trend (last 7 days) ───────────────────────────────
        var dailySummaries = await summaryRepository.FindByBranchAndRangeAsync(
            branchId, today.AddDays(-7), today, ct);

        if (dailySummaries.Count > 0)
        {
            decimal weekTotal = dailySummaries.Sum(s => s.TotalRevenue);
            var lines = dailySummaries
                .OrderBy(s => s.SummaryDate)
                .Select(s => $"  {s.SummaryDate:yyyy-MM-dd}: {s.TotalOrders} طلب | {s.TotalRevenue:F2} ر.س | متوسط {(s.TotalOrders > 0 ? s.TotalRevenue / s.TotalOrders : 0):F2} ر.س/طلب");
            sections.Add($"الأداء اليومي (آخر 7 أيام) - إجمالي: {weekTotal:F2} ر.س\n" + string.Join("\n", lines));
        }

        // ── 2. 30-day financial summary ───────────────────────────────────────
        var monthlySummaries = await summaryRepository.FindByBranchAndRangeAsync(
            branchId, today.AddDays(-30), today, ct);

        if (monthlySummaries.Count > 0)
        {
            decimal monthRevenue = monthlySummaries.Sum(s => s.TotalRevenue);
            int monthOrders = monthlySummaries.Sum(s => s.TotalOrders);
            decimal monthTax = monthlySummaries.Sum(s => s.TotalTax);
            decimal monthDiscounts = monthlySummaries.Sum(s => s.TotalDiscounts);
            decimal avgDaily30 = monthlySummaries.Count > 0 ? monthRevenue / monthlySummaries.Count : 0;
            sections.Add($"ملخص آخر 30 يوم:\n  الإيرادات: {monthRevenue:F2} | الطلبات: {monthOrders} | الضريبة: {monthTax:F2} | الخصومات: {monthDiscounts:F2} | متوسط يومي: {avgDaily30:F2} ر.س");
        }

        // ── 3. Payment method breakdown (last 30 days) ───────────────────────
        var saleRecords = await saleRecordRepository.FindByBranchAsync(
            branchId, thirtyDaysAgo, now, 1, 1000, ct);

        if (saleRecords.Count > 0)
        {
            decimal cashTotal = saleRecords.Where(r => r.PaymentMethod == PaymentMethod.Cash).Sum(r => r.TotalAmount);
            decimal cardTotal = saleRecords.Where(r => r.PaymentMethod == PaymentMethod.Card).Sum(r => r.TotalAmount);
            decimal allTotal = cashTotal + cardTotal;
            int cashPct = allTotal > 0 ? (int)(cashTotal / allTotal * 100) : 0;
            int cardPct = allTotal > 0 ? (int)(cardTotal / allTotal * 100) : 0;
            sections.Add($"طرق الدفع (آخر 30 يوم):\n  نقد: {cashTotal:F2} ر.س ({cashPct}%)\n  بطاقة: {cardTotal:F2} ر.س ({cardPct}%)");
        }

        // ── 4. Peak hours (last 7 days) ───────────────────────────────────────
        var recentOrders = await posDb.Orders
            .Where(o => o.BranchId == branchId
                     && o.Status == OrderStatus.Completed
                     && o.CompletedAt >= sevenDaysAgo)
            .Select(o => new { o.CompletedAt, o.TotalAmount })
            .AsNoTracking()
            .ToListAsync(ct);

        if (recentOrders.Count > 0)
        {
            var peakLines = recentOrders
                .GroupBy(o => o.CompletedAt!.Value.Hour)
                .OrderByDescending(g => g.Count())
                .Take(5)
                .Select(g => $"  الساعة {g.Key:D2}:00 — {g.Count()} طلب ({g.Sum(o => o.TotalAmount):F0} ر.س)");
            sections.Add("أفضل ساعات البيع (آخر 7 أيام):\n" + string.Join("\n", peakLines));
        }

        // ── 5. Top 10 products by quantity (last 30 days — in-memory grouping) ─
        var ordersWithLines = await posDb.Orders
            .Include(o => o.Lines)
            .Where(o => o.BranchId == branchId
                     && o.Status == OrderStatus.Completed
                     && o.CompletedAt >= thirtyDaysAgo)
            .AsNoTracking()
            .ToListAsync(ct);

        if (ordersWithLines.Count > 0)
        {
            var topProducts = ordersWithLines
                .SelectMany(o => o.Lines)
                .GroupBy(l => new { l.ProductName, l.VariantName })
                .Select(g => new
                {
                    g.Key.ProductName,
                    g.Key.VariantName,
                    TotalQty = g.Sum(l => l.Quantity),
                    TotalRevenue = g.Sum(l => l.LineTotal),
                })
                .OrderByDescending(x => x.TotalQty)
                .Take(10)
                .ToList();

            var productLines = topProducts.Select((p, i) =>
                $"  {i + 1}. {p.ProductName}{(string.IsNullOrWhiteSpace(p.VariantName) ? "" : $" ({p.VariantName})")} — {p.TotalQty} وحدة — {p.TotalRevenue:F2} ر.س");
            sections.Add("أكثر المنتجات مبيعاً (آخر 30 يوم):\n" + string.Join("\n", productLines));
        }

        // ── 6. Low stock alerts ───────────────────────────────────────────────
        var lowStockItems = await inventoryDb.StockItems
            .Where(s => s.BranchId == branchId && s.Quantity <= s.ReorderPoint)
            .OrderBy(s => s.Quantity)
            .Take(10)
            .AsNoTracking()
            .ToListAsync(ct);

        if (lowStockItems.Count > 0)
        {
            var variantIds = lowStockItems.Select(s => s.VariantId).ToList();
            var variants = await catalogDb.ProductVariants
                .Where(v => variantIds.Contains(v.Id.Value))
                .AsNoTracking()
                .ToListAsync(ct);

            var productIds = variants.Select(v => v.ProductId).Distinct().ToList();
            var products = await catalogDb.Products
                .Where(p => productIds.Contains(p.Id))
                .AsNoTracking()
                .ToDictionaryAsync(p => p.Id, ct);

            var variantMap = variants.ToDictionary(
                v => v.Id.Value,
                v => products.TryGetValue(v.ProductId, out var prod) ? $"{prod.Name} - {v.Name}" : v.Name);

            var alertLines = lowStockItems.Select(s =>
            {
                string name = variantMap.TryGetValue(s.VariantId, out string? n) ? n : s.VariantId.ToString()[..8];
                return $"  {name}: {s.Quantity} وحدة (حد الطلب: {s.ReorderPoint})";
            });
            sections.Add($"تحذير: {lowStockItems.Count} منتج بمخزون منخفض:\n" + string.Join("\n", alertLines));
        }

        // ── 7. Last 3 closed shifts ───────────────────────────────────────────
        var recentShifts = await posDb.CashierShifts
            .Where(s => s.BranchId == branchId && s.Status == ShiftStatus.Closed)
            .OrderByDescending(s => s.ClosedAt)
            .Take(3)
            .AsNoTracking()
            .ToListAsync(ct);

        if (recentShifts.Count > 0)
        {
            var shiftLines = recentShifts.Select(s =>
            {
                string variance = s.CashVariance.HasValue && s.CashVariance != 0
                    ? (s.CashVariance > 0 ? $" | فائض {s.CashVariance:F2}" : $" | عجز {Math.Abs(s.CashVariance.Value):F2}")
                    : "";
                return $"  {s.CashierName} ({s.ClosedAt:MM-dd HH:mm}): {s.TotalOrders} طلب | نقد {s.TotalCashSales:F2} | بطاقة {s.TotalCardSales:F2} | إجمالي {s.TotalSales:F2} ر.س{variance}";
            });
            sections.Add("آخر الشفتات المغلقة:\n" + string.Join("\n", shiftLines));
        }

        return sections.Count > 0
            ? "=== بيانات متجرك الحالية ===\n\n" + string.Join("\n\n", sections)
            : "لا توجد بيانات متاحة بعد.";
    }
}
