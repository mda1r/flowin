using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.ReceiveStock;

internal sealed class ReceiveStockCommandValidator : AbstractValidator<ReceiveStockCommand>
{
    public ReceiveStockCommandValidator()
    {
        RuleFor(x => x.StockItemId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity must be greater than zero.");
        RuleFor(x => x.Reference).MaximumLength(128).When(x => x.Reference is not null);
        RuleFor(x => x.Notes).MaximumLength(512).When(x => x.Notes is not null);
    }
}
