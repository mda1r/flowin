using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.AdjustStockMaterial;

internal sealed class AdjustStockMaterialCommandValidator : AbstractValidator<AdjustStockMaterialCommand>
{
    public AdjustStockMaterialCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.MaterialId).NotEmpty();
        RuleFor(x => x.NewQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}
