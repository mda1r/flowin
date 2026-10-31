using FluentValidation;

namespace NexusPOS.Finance.Application.Queries.GetExpenseSummary;

internal sealed class GetExpenseSummaryQueryValidator : AbstractValidator<GetExpenseSummaryQuery>
{
    public GetExpenseSummaryQueryValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.DateTo).GreaterThanOrEqualTo(x => x.DateFrom)
            .WithMessage("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
    }
}
