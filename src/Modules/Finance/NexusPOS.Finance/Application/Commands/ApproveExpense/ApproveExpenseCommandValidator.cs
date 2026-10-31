using FluentValidation;

namespace NexusPOS.Finance.Application.Commands.ApproveExpense;

internal sealed class ApproveExpenseCommandValidator : AbstractValidator<ApproveExpenseCommand>
{
    public ApproveExpenseCommandValidator()
    {
        RuleFor(x => x.ExpenseId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.ApprovedBy).NotEmpty();
    }
}
