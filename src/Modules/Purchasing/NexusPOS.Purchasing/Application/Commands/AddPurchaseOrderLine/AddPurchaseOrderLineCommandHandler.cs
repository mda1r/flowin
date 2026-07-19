using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.AddPurchaseOrderLine;

internal sealed class AddPurchaseOrderLineCommandHandler(
    IPurchaseOrderRepository purchaseOrderRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<AddPurchaseOrderLineCommand, PurchaseOrderResponse>
{
    public async Task<ErrorOr<PurchaseOrderResponse>> Handle(
        AddPurchaseOrderLineCommand request,
        CancellationToken cancellationToken)
    {
        PurchaseOrder? order = await purchaseOrderRepository.FindByIdAsync(
            new PurchaseOrderId(request.PurchaseOrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PurchasingErrors.PurchaseOrderNotFound;
        }

        ErrorOr<PurchaseOrderLine> lineResult = order.AddLine(
            request.VariantId, request.Description, request.UnitCost, request.Quantity);

        if (lineResult.IsError)
        {
            return lineResult.Errors;
        }

        purchaseOrderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(order);
    }
}
