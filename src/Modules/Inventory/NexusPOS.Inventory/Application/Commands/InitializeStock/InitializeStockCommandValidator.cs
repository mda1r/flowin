using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.InitializeStock;

internal sealed class InitializeStockCommandValidator : AbstractValidator<InitializeStockCommand>
{
    public InitializeStockCommandValidator()
    {
        RuleFor(x => x.VariantId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.ReorderPoint).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ReorderQuantity).GreaterThanOrEqualTo(0);
    }
}
