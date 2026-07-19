using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.CreatePurchaseOrder;

internal sealed class CreatePurchaseOrderCommandHandler(
    ISupplierRepository supplierRepository,
    IPurchaseOrderRepository purchaseOrderRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<CreatePurchaseOrderCommand, PurchaseOrderResponse>
{
    public async Task<ErrorOr<PurchaseOrderResponse>> Handle(
        CreatePurchaseOrderCommand request,
        CancellationToken cancellationToken)
    {
        bool supplierExists = (await supplierRepository.FindByIdAsync(
            new SupplierId(request.SupplierId), cancellationToken)) is not null;

        if (!supplierExists)
        {
            return PurchasingErrors.SupplierNotFound;
        }

        PurchaseOrder order = PurchaseOrder.Create(
            request.TenantId,
            request.BranchId,
            new SupplierId(request.SupplierId),
            request.ExpectedDeliveryDate,
            request.Notes);

        purchaseOrderRepository.Add(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(order);
    }
}
