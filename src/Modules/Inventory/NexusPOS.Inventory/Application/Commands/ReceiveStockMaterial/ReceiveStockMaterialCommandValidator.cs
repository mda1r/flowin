using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.ReceiveStockMaterial;

internal sealed class ReceiveStockMaterialCommandValidator : AbstractValidator<ReceiveStockMaterialCommand>
{
    public ReceiveStockMaterialCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.MaterialId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.UnitCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Note).MaximumLength(500).When(x => x.Note is not null);
    }
}
