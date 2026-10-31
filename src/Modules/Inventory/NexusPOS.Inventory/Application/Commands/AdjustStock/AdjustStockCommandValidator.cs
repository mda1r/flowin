using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.AdjustStock;

internal sealed class AdjustStockCommandValidator : AbstractValidator<AdjustStockCommand>
{
    public AdjustStockCommandValidator()
    {
        RuleFor(x => x.StockItemId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.NewQuantity).GreaterThanOrEqualTo(0).WithMessage("New quantity must not be negative.");
        RuleFor(x => x.Reference).MaximumLength(128).When(x => x.Reference is not null);
        RuleFor(x => x.Notes).MaximumLength(512).When(x => x.Notes is not null);
    }
}
