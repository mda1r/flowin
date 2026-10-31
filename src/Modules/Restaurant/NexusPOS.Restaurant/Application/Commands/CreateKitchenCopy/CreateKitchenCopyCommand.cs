using FluentValidation;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateKitchenCopy;

public sealed record KitchenCopyNoteInput(Guid CatalogItemId, string? Notes);

// A sale the cafe till has already charged, copied here only so it shows on the kitchen screen. The dishes,
// names and prices come from that sale; the till only adds the table and the cook's notes.
public sealed record CreateKitchenCopyCommand(
    Guid BranchId,
    Guid PosOrderId,
    int TableNumber,
    IReadOnlyList<KitchenCopyNoteInput> ItemNotes,
    string? Notes) : ICommand<RestaurantOrderResponse>;

internal sealed class CreateKitchenCopyCommandValidator : AbstractValidator<CreateKitchenCopyCommand>
{
    public CreateKitchenCopyCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.PosOrderId).NotEmpty();
        RuleFor(x => x.TableNumber).GreaterThan(0);
        RuleForEach(x => x.ItemNotes).ChildRules(item =>
        {
            item.RuleFor(i => i.CatalogItemId).NotEmpty();
            item.RuleFor(i => i.Notes).MaximumLength(256);
        });
        RuleFor(x => x.Notes).MaximumLength(512);
    }
}
