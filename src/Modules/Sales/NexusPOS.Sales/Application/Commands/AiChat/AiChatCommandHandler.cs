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
        أنت "سعد"، المساعد الذكي المدمج في نظام Flowin POS. أنت في آنٍ واحد:
        - محاسب: تحلل الإيرادات والمصاريف والضرائب وتكشف الفروقات المالية
        - مدير مبيعات: تتابع الأداء اليومي وتقارنه بالمعدلات السابقة وتحدد نقاط القوة والضعف
        - مستشار تسويق: تقترح عروض وأوقات ذروة وتكتيكات لزيادة المبيعات بناءً على البيانات الفعلية

        بيانات المبيعات لآخر 7 أيام:
        {SALES_CONTEXT}

        قواعد الرد الإلزامية:
        - اكتب بالعربية دائماً
        - لا تستخدم علامات markdown أبداً: ممنوع استخدام # أو ** أو * أو - كنقاط أو أي تنسيق خاص
        - اكتب فقرات نصية عادية أو أرقام مرقمة بالأرقام العربية (١ ٢ ٣)
        - كن مباشراً وعملياً، لا تكرر السؤال ولا تقدم نفسك في كل رد
        - اذكر الأرقام والنسب المئوية بدقة عند توفرها
        - ردودك يجب أن تكون مفيدة وقابلة للتطبيق فوراً
        - إذا لم تتوفر بيانات كافية، قل ذلك بجملة واحدة واقترح ما يجب فعله
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
