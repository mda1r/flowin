using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.AddPurchaseOrderLine;

internal sealed class AddPurchaseOrderLineCommandHandler(
    IPurchaseOrderRepository purchaseOrderRepository,
    PurchasingDbContext dbContext,
    IStockMaterialDirectory stockMaterials)
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

        if (request.StockMaterialId is Guid requestedMaterial
            && !await stockMaterials.ExistsAsync(order.TenantId, requestedMaterial, cancellationToken))
        {
            return PurchasingErrors.StockMaterialNotFound;
        }

        ErrorOr<PurchaseOrderLine> lineResult = request.StockMaterialId is Guid materialId
            ? order.AddMaterialLine(materialId, request.Description, request.UnitCost, request.Quantity)
            : order.AddLine(request.VariantId!.Value, request.Description, request.UnitCost, request.Quantity);

        if (lineResult.IsError)
        {
            return lineResult.Errors;
        }

        purchaseOrderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(order);
    }
}
