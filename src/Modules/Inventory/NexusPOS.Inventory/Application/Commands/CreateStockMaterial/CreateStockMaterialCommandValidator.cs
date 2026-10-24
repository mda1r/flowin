using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.CreateStockMaterial;

internal sealed class CreateStockMaterialCommandValidator : AbstractValidator<CreateStockMaterialCommand>
{
    public CreateStockMaterialCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.NameAr).NotEmpty().MaximumLength(200);
        RuleFor(x => x.NameEn).MaximumLength(200).When(x => x.NameEn is not null);
        RuleFor(x => x.StorageUnit).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ComponentUnit).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ConversionFactor).GreaterThan(0);
        RuleFor(x => x.InitialCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MinLevel).GreaterThanOrEqualTo(0).When(x => x.MinLevel.HasValue);
        RuleFor(x => x.MaxLevel).GreaterThanOrEqualTo(0).When(x => x.MaxLevel.HasValue);
        RuleFor(x => x.ReorderLevel).GreaterThanOrEqualTo(0).When(x => x.ReorderLevel.HasValue);
    }
}
