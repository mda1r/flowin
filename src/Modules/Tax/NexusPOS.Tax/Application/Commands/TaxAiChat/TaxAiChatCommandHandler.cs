using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.TaxAiChat;

internal sealed class TaxAiChatCommandHandler(
    IClaudeApiService claude,
    TaxConfigDbContext db)
    : ICommandHandler<TaxAiChatCommand, string>
{
    private const string SystemPrompt = """
        أنت "ضريبي"، المستشار الضريبي الذكي المدمج في نظام Flowin POS.
        أنت متخصص في:
        - قوانين ضريبة القيمة المضافة (VAT) السعودية ونسبة 15%
        - تحليل دفتر الضريبة وتفسير القيود
        - شرح الشذوذات الضريبية وتقديم الحلول
        - إعداد الإقرار الضريبي (نموذج ZATCA Form 15)
        - حساب الضريبة المستحقة والمطالبات الاسترداد

        قواعد الرد الإلزامية:
        - اكتب بالعربية دائماً
        - لا تستخدم علامات markdown أبداً: ممنوع # أو ** أو * كعلامات تنسيق
        - اكتب فقرات نصية عادية أو أرقام مرقمة (١ ٢ ٣)
        - كن مباشراً وعملياً
        - اذكر الأرقام بدقة مع وحدة الريال السعودي
        - إذا لم تكن البيانات متوفرة، اذكر ذلك بوضوح
        """;

    public async Task<ErrorOr<string>> Handle(
        TaxAiChatCommand request,
        CancellationToken cancellationToken)
    {
        string context = await BuildContextAsync(request.TenantId, request.PeriodId, cancellationToken);
        string fullMessage = $"{context}\n\nسؤال المستخدم: {request.Message}";
        string response = await claude.ChatAsync(SystemPrompt, fullMessage, cancellationToken);
        return response;
    }

    private async Task<string> BuildContextAsync(Guid tenantId, Guid? periodId, CancellationToken ct)
    {
        var sections = new List<string>();

        // ── Period info ───────────────────────────────────────────────────────
        TaxPeriod? period = periodId.HasValue
            ? await db.TaxPeriods
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == periodId.Value && p.TenantId == tenantId, ct)
            : await db.TaxPeriods
                .AsNoTracking()
                .Where(p => p.TenantId == tenantId)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefaultAsync(ct);

        if (period is null)
        {
            return "لا توجد فترات ضريبية مسجلة بعد.";
        }

        sections.Add($"الفترة الضريبية الحالية: {period.StartDate:yyyy-MM-dd} إلى {period.EndDate:yyyy-MM-dd} | الحالة: {(period.Status == "open" ? "مفتوحة" : "مغلقة")}");

        // ── Ledger summary ────────────────────────────────────────────────────
        try
        {
            List<TaxLedgerEntry> entries = await db.TaxLedgerEntries
                .AsNoTracking()
                .Where(e => e.TenantId == tenantId && e.PeriodId == period.Id)
                .ToListAsync(ct);

            if (entries.Count > 0)
            {
                decimal outputVat = entries.Where(e => e.EntryType == LedgerEntryType.Output).Sum(e => e.TaxAmount);
                decimal inputVat = entries.Where(e => e.EntryType == LedgerEntryType.Input).Sum(e => e.TaxAmount);
                decimal outputBase = entries.Where(e => e.EntryType == LedgerEntryType.Output).Sum(e => e.BaseAmount);
                decimal inputBase = entries.Where(e => e.EntryType == LedgerEntryType.Input).Sum(e => e.BaseAmount);
                int saleCount = entries.Count(e => e.TransactionType == LedgerTransactionType.Sale);
                int purchaseCount = entries.Count(e => e.TransactionType == LedgerTransactionType.PurchaseInvoice);

                sections.Add(
                    $"ملخص دفتر الضريبة ({entries.Count} قيد):\n" +
                    $"  ضريبة الإخراج (المبيعات): {outputVat:F2} ر.س على وعاء {outputBase:F2} ر.س ({saleCount} معاملة)\n" +
                    $"  ضريبة الإدخال (المشتريات): {inputVat:F2} ر.س على وعاء {inputBase:F2} ر.س ({purchaseCount} فاتورة)\n" +
                    $"  صافي الضريبة المستحقة: {outputVat - inputVat:F2} ر.س");
            }
            else
            {
                sections.Add("لا توجد قيود في دفتر الضريبة لهذه الفترة — استخدم 'استيراد المبيعات' لجلب البيانات.");
            }
        }
        catch { /* skip */ }

        // ── Anomalies ─────────────────────────────────────────────────────────
        try
        {
            List<TaxAnomaly> anomalies = await db.TaxAnomalies
                .AsNoTracking()
                .Where(a => a.TenantId == tenantId && a.PeriodId == period.Id && !a.IsResolved)
                .ToListAsync(ct);

            if (anomalies.Count > 0)
            {
                int errors = anomalies.Count(a => a.Severity == AnomalySeverity.Error);
                int warnings = anomalies.Count(a => a.Severity == AnomalySeverity.Warning);
                int infos = anomalies.Count(a => a.Severity == AnomalySeverity.Info);

                var anomalyLines = anomalies.Take(5).Select(a =>
                    $"  [{a.Severity.ToUpperInvariant()}] {a.RuleCode}: {a.Title}");

                sections.Add(
                    $"المخالفات والشذوذات ({anomalies.Count} مفتوحة - أخطاء: {errors} | تحذيرات: {warnings} | معلومات: {infos}):\n" +
                    string.Join("\n", anomalyLines) +
                    (anomalies.Count > 5 ? $"\n  ... و{anomalies.Count - 5} أخرى" : ""));
            }
            else
            {
                sections.Add("لا توجد مخالفات مفتوحة — الوضع الضريبي سليم.");
            }
        }
        catch { /* skip */ }

        // ── Readiness score ───────────────────────────────────────────────────
        try
        {
            bool hasEntries = await db.TaxLedgerEntries
                .AnyAsync(e => e.TenantId == tenantId && e.PeriodId == period.Id, ct);

            int openAnomalies = await db.TaxAnomalies
                .CountAsync(a => a.TenantId == tenantId && a.PeriodId == period.Id && !a.IsResolved, ct);

            int score = period.Status == "closed" ? 100 :
                        !hasEntries ? 60 :
                        Math.Max(0, 100 - (openAnomalies * 10));

            sections.Add($"درجة الجاهزية الضريبية: {score}/100 {(score >= 80 ? "(جيد)" : score >= 60 ? "(يحتاج مراجعة)" : "(يحتاج إجراء عاجل)")}");
        }
        catch { /* skip */ }

        return "=== بيانات الضريبة الحالية ===\n\n" + string.Join("\n\n", sections);
    }
}
