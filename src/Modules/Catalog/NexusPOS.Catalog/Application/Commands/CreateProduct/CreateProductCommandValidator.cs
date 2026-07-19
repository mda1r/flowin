using FluentValidation;

namespace NexusPOS.Catalog.Application.Commands.CreateProduct;

internal sealed class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(256);

        RuleFor(x => x.Description)
            .MaximumLength(2048)
            .When(x => x.Description is not null);

        RuleFor(x => x.Type)
            .IsInEnum();

        RuleFor(x => x.TaxClass)
            .IsInEnum();

        RuleFor(x => x.Sku)
            .NotEmpty()
            .MaximumLength(64);

        RuleFor(x => x.VariantName)
            .NotEmpty()
            .MaximumLength(256);

        RuleFor(x => x.CostPrice)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.SalePrice)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3);

        RuleFor(x => x.Barcode)
            .MaximumLength(64)
            .When(x => x.Barcode is not null);
    }
}
