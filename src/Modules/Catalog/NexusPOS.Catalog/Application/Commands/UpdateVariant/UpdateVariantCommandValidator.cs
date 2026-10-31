using FluentValidation;

namespace NexusPOS.Catalog.Application.Commands.UpdateVariant;

internal sealed class UpdateVariantCommandValidator : AbstractValidator<UpdateVariantCommand>
{
    public UpdateVariantCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.CostPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Barcode).MaximumLength(64).When(x => x.Barcode is not null);
        RuleFor(x => x.Sku).NotEmpty().MaximumLength(64).When(x => x.Sku is not null);
    }
}
