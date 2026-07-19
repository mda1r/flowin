using FluentValidation;
using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Application.Commands.ApplyOrderDiscount;

internal sealed class ApplyOrderDiscountCommandValidator : AbstractValidator<ApplyOrderDiscountCommand>
{
    public ApplyOrderDiscountCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.DiscountValue).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DiscountValue)
            .LessThanOrEqualTo(100)
            .When(x => x.DiscountType == DiscountType.Percentage)
            .WithMessage("Percentage discount cannot exceed 100%.");
    }
}
