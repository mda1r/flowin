using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.RemovePurchaseOrderLine;

internal sealed class RemovePurchaseOrderLineCommandValidator : AbstractValidator<RemovePurchaseOrderLineCommand>
{
    public RemovePurchaseOrderLineCommandValidator()
    {
        RuleFor(x => x.PurchaseOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.LineId).NotEmpty();
    }
}
