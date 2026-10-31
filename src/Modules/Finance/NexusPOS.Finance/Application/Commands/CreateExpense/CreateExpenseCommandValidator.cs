using FluentValidation;

namespace NexusPOS.Finance.Application.Commands.CreateExpense;

internal sealed class CreateExpenseCommandValidator : AbstractValidator<CreateExpenseCommand>
{
    public CreateExpenseCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(512);
        RuleFor(x => x.Notes).MaximumLength(1024).When(x => x.Notes is not null);
    }
}
