using ErrorOr;
using NexusPOS.Sales.Application.Services;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Commands.AiChat;

internal sealed class AiChatCommandHandler(
    IClaudeApiService claude,
    ISalesSummaryRepository summaryRepository)
    : ICommandHandler<AiChatCommand, string>
{
    private const string SystemPromptTemplate = """
        أنت مساعد ذكي لنظام نقاط البيع NexusPOS. تساعد أصحاب المحلات والمديرين على فهم بياناتهم واتخاذ قرارات أفضل.

        بيانات المبيعات لآخر 7 أيام:
        {SALES_CONTEXT}

        الإرشادات:
        - أجب باللغة العربية دائماً
        - كن موجزاً ومفيداً
        - ركز على الرؤى العملية والتوصيات
        - اذكر الأرقام بدقة عند توفرها
        """;

    public async Task<ErrorOr<string>> Handle(AiChatCommand request, CancellationToken cancellationToken)
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly weekAgo = today.AddDays(-7);

        var summaries = await summaryRepository.FindByBranchAndRangeAsync(
            request.BranchId, weekAgo, today, cancellationToken);

        var salesLines = summaries
            .OrderBy(s => s.SummaryDate)
            .Select(s => $"- {s.SummaryDate:yyyy-MM-dd}: {s.TotalOrders} طلب، إجمالي {s.TotalRevenue:F2} {s.Currency}");

        string salesContext = summaries.Count > 0
            ? string.Join("\n", salesLines)
            : "لا توجد بيانات مبيعات للأسبوع الماضي.";

        string systemPrompt = SystemPromptTemplate.Replace("{SALES_CONTEXT}", salesContext);

        string response = await claude.ChatAsync(systemPrompt, request.Message, cancellationToken);
        return response;
    }
}
