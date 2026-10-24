using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.AddPurchaseOrderLine;

internal sealed class AddPurchaseOrderLineCommandValidator : AbstractValidator<AddPurchaseOrderLineCommand>
{
    public AddPurchaseOrderLineCommandValidator()
    {
        RuleFor(x => x.PurchaseOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x)
            .Must(x => (x.VariantId is Guid v && v != Guid.Empty) ^ (x.StockMaterialId is Guid m && m != Guid.Empty))
            .WithName("Item")
            .WithMessage("Specify exactly one of VariantId or StockMaterialId.");
        RuleFor(x => x.Description).NotEmpty().MaximumLength(512);
        RuleFor(x => x.UnitCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
