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

        // An expense is booked when it happens; a future date hides it in a month nobody is looking at.
        // Saudi Arabia is UTC+3 all year; one day of slack covers a till whose clock runs a little ahead.
        RuleFor(x => x.ExpenseDate)
            .Must(d => d <= DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3)).AddDays(1))
            .WithMessage("تاريخ المصروف في المستقبل، اختر تاريخ اليوم أو قبله");
    }
}
