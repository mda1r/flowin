using FluentValidation;

namespace NexusPOS.POS.Application.Commands.CloseShift;

internal sealed class CloseShiftCommandValidator : AbstractValidator<CloseShiftCommand>
{
    public CloseShiftCommandValidator()
    {
        RuleFor(x => x.ShiftId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.ClosingCash)
            .GreaterThanOrEqualTo(0).WithMessage("النقد المعدود لا يمكن أن يكون سالباً.")
            .LessThan(OpenShift.OpenShiftCommandValidator.MaxCash);
        RuleFor(x => x.ClosingCardCount)
            .GreaterThanOrEqualTo(0).WithMessage("إجمالي البطاقات لا يمكن أن يكون سالباً.")
            .LessThan(OpenShift.OpenShiftCommandValidator.MaxCash);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}
