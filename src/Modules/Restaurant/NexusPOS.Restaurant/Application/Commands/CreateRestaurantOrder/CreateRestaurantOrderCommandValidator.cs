using FluentValidation;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

internal sealed class CreateRestaurantOrderCommandValidator : AbstractValidator<CreateRestaurantOrderCommand>
{
    public CreateRestaurantOrderCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.TableNumber).GreaterThan(0);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.MenuItemId).NotEmpty();
            item.RuleFor(i => i.ItemName).NotEmpty().MaximumLength(128);
            item.RuleFor(i => i.Quantity).GreaterThan(0);
            item.RuleFor(i => i.UnitPrice).GreaterThan(0);
        });
    }
}
