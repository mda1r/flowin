using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.SendPurchaseOrder;

internal sealed class SendPurchaseOrderCommandValidator : AbstractValidator<SendPurchaseOrderCommand>
{
    public SendPurchaseOrderCommandValidator()
    {
        RuleFor(x => x.PurchaseOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
