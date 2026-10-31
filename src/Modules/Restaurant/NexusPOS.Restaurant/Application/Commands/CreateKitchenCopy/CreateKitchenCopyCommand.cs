using FluentValidation;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateKitchenCopy;

public sealed record KitchenCopyItemInput(
    Guid CatalogItemId,
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    string? Notes);

// A sale the cafe till has already charged, copied here only so it shows on the kitchen screen.
public sealed record CreateKitchenCopyCommand(
    Guid BranchId,
    int TableNumber,
    IReadOnlyList<KitchenCopyItemInput> Items,
    string? Notes) : ICommand<RestaurantOrderResponse>;

internal sealed class CreateKitchenCopyCommandValidator : AbstractValidator<CreateKitchenCopyCommand>
{
    public CreateKitchenCopyCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.TableNumber).GreaterThan(0);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.CatalogItemId).NotEmpty();
            item.RuleFor(i => i.ItemName).NotEmpty().MaximumLength(128);
            item.RuleFor(i => i.Quantity).GreaterThan(0);
            item.RuleFor(i => i.UnitPrice).GreaterThanOrEqualTo(0);
            item.RuleFor(i => i.Notes).MaximumLength(256);
        });
        RuleFor(x => x.Notes).MaximumLength(512);
    }
}
