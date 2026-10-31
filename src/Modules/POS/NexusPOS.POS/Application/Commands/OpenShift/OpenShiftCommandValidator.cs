using FluentValidation;

namespace NexusPOS.POS.Application.Commands.OpenShift;

internal sealed class OpenShiftCommandValidator : AbstractValidator<OpenShiftCommand>
{
    // Fits the NUMERIC(18,4) columns with room to spare; anything near it is a typo, not a drawer.
    internal const decimal MaxCash = 100_000_000m;

    public OpenShiftCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.OpeningCash)
            .GreaterThanOrEqualTo(0).WithMessage("رصيد الفتح لا يمكن أن يكون سالباً.")
            .LessThan(MaxCash);
    }
}
