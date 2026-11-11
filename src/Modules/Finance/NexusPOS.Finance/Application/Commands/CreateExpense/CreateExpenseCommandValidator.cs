using FluentValidation;

namespace NexusPOS.Finance.Application.Commands.CreateExpense;

internal sealed class CreateExpenseCommandValidator : AbstractValidator<CreateExpenseCommand>
{
    public CreateExpenseCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("المبلغ يجب أن يكون أكبر من صفر");
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.Description).NotEmpty().WithMessage("اكتب وصف المصروف").MaximumLength(512);
        RuleFor(x => x.Notes).MaximumLength(1024).When(x => x.Notes is not null);
    }
}
