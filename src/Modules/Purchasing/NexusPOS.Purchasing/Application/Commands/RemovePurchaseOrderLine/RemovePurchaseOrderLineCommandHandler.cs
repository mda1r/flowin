using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.RemovePurchaseOrderLine;

internal sealed class RemovePurchaseOrderLineCommandHandler(
    IPurchaseOrderRepository purchaseOrderRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<RemovePurchaseOrderLineCommand, PurchaseOrderResponse>
{
    public async Task<ErrorOr<PurchaseOrderResponse>> Handle(
        RemovePurchaseOrderLineCommand request,
        CancellationToken cancellationToken)
    {
        PurchaseOrder? order = await purchaseOrderRepository.FindByIdAsync(
            new PurchaseOrderId(request.PurchaseOrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PurchasingErrors.PurchaseOrderNotFound;
        }

        ErrorOr<Success> removeResult = order.RemoveLine(new PurchaseOrderLineId(request.LineId));
        if (removeResult.IsError)
        {
            return removeResult.Errors;
        }

        purchaseOrderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(order);
    }
}
