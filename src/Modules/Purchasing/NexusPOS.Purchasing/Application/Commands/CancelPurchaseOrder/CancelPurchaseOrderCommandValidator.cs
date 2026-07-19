using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.CancelPurchaseOrder;

internal sealed class CancelPurchaseOrderCommandValidator : AbstractValidator<CancelPurchaseOrderCommand>
{
    public CancelPurchaseOrderCommandValidator()
    {
        RuleFor(x => x.PurchaseOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Reason).MaximumLength(512).When(x => x.Reason is not null);
    }
}
