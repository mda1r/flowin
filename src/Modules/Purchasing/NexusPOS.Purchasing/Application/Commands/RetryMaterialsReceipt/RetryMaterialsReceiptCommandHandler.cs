using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.Purchasing.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.RetryMaterialsReceipt;

internal sealed class RetryMaterialsReceiptCommandHandler(
    IPurchaseOrderRepository purchaseOrderRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<RetryMaterialsReceiptCommand, PurchaseOrderResponse>
{
    public async Task<ErrorOr<PurchaseOrderResponse>> Handle(
        RetryMaterialsReceiptCommand request,
        CancellationToken cancellationToken)
    {
        PurchaseOrder? order = await purchaseOrderRepository.FindByIdAsync(
            new PurchaseOrderId(request.PurchaseOrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PurchasingErrors.PurchaseOrderNotFound;
        }

        ErrorOr<Success> result = order.RetryMaterialsReceipt();
        if (result.IsError)
        {
            return result.Errors;
        }

        // Saving publishes the domain event; the order row itself is unchanged.
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(order);
    }
}
