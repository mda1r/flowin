using FluentValidation;
using NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.AddOrderItems;

// Another round for a table's open order, so the table keeps one bill. SendToKitchen also sends an order
// that is still waiting; an order already in the kitchen takes the new lines there anyway.
public sealed record AddOrderItemsCommand(
    Guid OrderId,
    Guid BranchId,
    IReadOnlyList<OrderItemInput> Items,
    bool SendToKitchen) : ICommand<RestaurantOrderResponse>;

internal sealed class AddOrderItemsCommandValidator : AbstractValidator<AddOrderItemsCommand>
{
    public AddOrderItemsCommandValidator()
    {
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.MenuItemId).NotEmpty();
            item.RuleFor(i => i.Quantity).GreaterThan(0);
            item.RuleFor(i => i.Notes).MaximumLength(256);
        });
    }
}
