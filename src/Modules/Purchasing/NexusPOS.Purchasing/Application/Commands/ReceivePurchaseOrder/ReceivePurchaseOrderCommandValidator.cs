using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.ReceivePurchaseOrder;

internal sealed class ReceivePurchaseOrderCommandValidator : AbstractValidator<ReceivePurchaseOrderCommand>
{
    public ReceivePurchaseOrderCommandValidator()
    {
        RuleFor(x => x.PurchaseOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
