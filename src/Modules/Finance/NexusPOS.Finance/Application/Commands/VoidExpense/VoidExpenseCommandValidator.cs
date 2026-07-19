using FluentValidation;

namespace NexusPOS.Finance.Application.Commands.VoidExpense;

internal sealed class VoidExpenseCommandValidator : AbstractValidator<VoidExpenseCommand>
{
    public VoidExpenseCommandValidator()
    {
        RuleFor(x => x.ExpenseId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Reason).MaximumLength(512).When(x => x.Reason is not null);
    }
}
