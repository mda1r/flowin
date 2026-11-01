using FluentValidation;
using NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;

namespace NexusPOS.Restaurant.Application.Commands.UpdateDiscountCode;

// An expiry already in the past is allowed here: it is how an owner ends a code early, and an old code keeps its date.
internal sealed class UpdateDiscountCodeCommandValidator : AbstractValidator<UpdateDiscountCodeCommand>
{
    public UpdateDiscountCodeCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Id).NotEmpty();
        DiscountCodeRules.Apply(this, x => x.Code, x => x.Label, x => x.Type, x => x.Value, x => x.MinOrderAmount, x => x.MaxUses);
    }
}
