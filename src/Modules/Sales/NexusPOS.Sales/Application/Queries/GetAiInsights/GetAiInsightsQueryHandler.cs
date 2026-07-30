using ErrorOr;
using NexusPOS.Sales.Application.Services;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.GetAiInsights;

internal sealed class GetAiInsightsQueryHandler(
    IClaudeApiService claude,
    ISalesSummaryRepository summaryRepository)
    : IQueryHandler<GetAiInsightsQuery, AiInsightsResponse>
{
    public async Task<ErrorOr<AiInsightsResponse>> Handle(
        GetAiInsightsQuery request,
        CancellationToken cancellationToken)
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly monthAgo = today.AddDays(-30);

        IReadOnlyList<SalesSummary> summaries = await summaryRepository.FindByBranchAndRangeAsync(
            request.BranchId, monthAgo, today, cancellationToken);

        if (summaries.Count == 0)
        {
            return new AiInsightsResponse(
                "لا توجد بيانات مبيعات كافية لتوليد رؤى.",
                "ابدأ بتسجيل المبيعات لرؤية الاتجاهات.",
                "أنشئ أول طلب مبيعات للبدء.",
                DateTime.UtcNow);
        }

        decimal totalRevenue = summaries.Sum(s => s.TotalRevenue);
        int totalOrders = summaries.Sum(s => s.TotalOrders);
        string currency = summaries[0].Currency;
        decimal avgDaily = totalRevenue / summaries.Count;

        var recent7 = summaries.OrderByDescending(s => s.SummaryDate).Take(7).ToList();
        var prev7 = summaries.OrderByDescending(s => s.SummaryDate).Skip(7).Take(7).ToList();

        decimal recent7Revenue = recent7.Sum(s => s.TotalRevenue);
        decimal prev7Revenue = prev7.Sum(s => s.TotalRevenue);

        string dataContext = $"""
            بيانات المبيعات (آخر 30 يوم):
            - إجمالي الإيرادات: {totalRevenue:F2} {currency}
            - إجمالي الطلبات: {totalOrders}
            - متوسط يومي: {avgDaily:F2} {currency}
            - آخر 7 أيام: {recent7Revenue:F2} {currency}
            - الـ 7 أيام السابقة: {prev7Revenue:F2} {currency}
            - التغيير: {(prev7Revenue > 0 ? (recent7Revenue - prev7Revenue) / prev7Revenue * 100 : 0):F1}%
            """;

        string salesInsight = await claude.ChatAsync(
            "أنت محلل مبيعات خبير. أجب باللغة العربية في جملة واحدة موجزة.",
            $"{dataContext}\n\nقدم رؤية موجزة عن أداء المبيعات.",
            cancellationToken);

        string trendInsight = await claude.ChatAsync(
            "أنت محلل مبيعات خبير. أجب باللغة العربية في جملة واحدة موجزة.",
            $"{dataContext}\n\nما هو اتجاه المبيعات؟ هل ترتفع أم تنخفض؟",
            cancellationToken);

        string recommendation = await claude.ChatAsync(
            "أنت مستشار أعمال خبير. أجب باللغة العربية في جملة واحدة موجزة.",
            $"{dataContext}\n\nما هي أهم توصية لتحسين المبيعات؟",
            cancellationToken);

        return new AiInsightsResponse(salesInsight, trendInsight, recommendation, DateTime.UtcNow);
    }
}
