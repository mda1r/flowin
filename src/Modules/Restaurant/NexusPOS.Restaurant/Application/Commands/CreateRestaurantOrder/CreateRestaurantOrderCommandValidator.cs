using FluentValidation;
using NexusPOS.Restaurant.Application.Common;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

internal sealed class CreateRestaurantOrderCommandValidator : AbstractValidator<CreateRestaurantOrderCommand>
{
    public CreateRestaurantOrderCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.TableNumber).GreaterThan(0);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.MenuItemId).NotEmpty();
            item.RuleFor(i => i.Quantity).GreaterThan(0);
            item.RuleFor(i => i.Notes).MaximumLength(256);
        });
        RuleFor(x => x.Notes).MaximumLength(512);
        RuleFor(x => x.OrderId).NotEqual(Guid.Empty);
        When(x => x.Payment is not null, () =>
        {
            RuleFor(x => x.Payment!.PaymentMethod).Must(m => m is RestaurantPayment.Cash or RestaurantPayment.Card);
            RuleFor(x => x.Payment!.AmountTendered).GreaterThan(0);
        });
    }
}
