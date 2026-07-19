using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.CancelPurchaseOrder;

internal sealed class CancelPurchaseOrderCommandHandler(
    IPurchaseOrderRepository purchaseOrderRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<CancelPurchaseOrderCommand, PurchaseOrderResponse>
{
    public async Task<ErrorOr<PurchaseOrderResponse>> Handle(
        CancelPurchaseOrderCommand request,
        CancellationToken cancellationToken)
    {
        PurchaseOrder? order = await purchaseOrderRepository.FindByIdAsync(
            new PurchaseOrderId(request.PurchaseOrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PurchasingErrors.PurchaseOrderNotFound;
        }

        ErrorOr<Success> cancelResult = order.Cancel(request.Reason);
        if (cancelResult.IsError)
        {
            return cancelResult.Errors;
        }

        purchaseOrderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(order);
    }
}
