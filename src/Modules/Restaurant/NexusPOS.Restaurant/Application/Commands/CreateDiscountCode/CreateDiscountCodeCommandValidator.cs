using FluentValidation;

namespace NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;

internal sealed class CreateDiscountCodeCommandValidator : AbstractValidator<CreateDiscountCodeCommand>
{
    public CreateDiscountCodeCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().MaximumLength(32);
        RuleFor(x => x.Value).GreaterThan(0);
        RuleFor(x => x.MinOrderAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxUses).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ExpiryDate).GreaterThan(DateTime.UtcNow);
    }
}
