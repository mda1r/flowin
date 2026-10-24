using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.UpdateStockMaterial;

internal sealed class UpdateStockMaterialCommandValidator : AbstractValidator<UpdateStockMaterialCommand>
{
    public UpdateStockMaterialCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.MaterialId).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.NameAr).NotEmpty().MaximumLength(200);
        RuleFor(x => x.NameEn).MaximumLength(200).When(x => x.NameEn is not null);
        RuleFor(x => x.StorageUnit).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ComponentUnit).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ConversionFactor).GreaterThan(0);
        RuleFor(x => x.ManualCost).GreaterThanOrEqualTo(0).When(x => x.ManualCost.HasValue);
        RuleFor(x => x.MinLevel).GreaterThanOrEqualTo(0).When(x => x.MinLevel.HasValue);
        RuleFor(x => x.MaxLevel).GreaterThanOrEqualTo(0).When(x => x.MaxLevel.HasValue);
        RuleFor(x => x.ReorderLevel).GreaterThanOrEqualTo(0).When(x => x.ReorderLevel.HasValue);
    }
}
