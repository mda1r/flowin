using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.DeactivateSupplier;

internal sealed class DeactivateSupplierCommandHandler(
    ISupplierRepository supplierRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<DeactivateSupplierCommand, SupplierResponse>
{
    public async Task<ErrorOr<SupplierResponse>> Handle(
        DeactivateSupplierCommand request,
        CancellationToken cancellationToken)
    {
        Supplier? supplier = await supplierRepository.FindByIdAsync(
            new SupplierId(request.SupplierId), cancellationToken);

        if (supplier is null || supplier.TenantId != request.TenantId)
        {
            return PurchasingErrors.SupplierNotFound;
        }

        supplier.Deactivate();

        supplierRepository.Update(supplier);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(supplier);
    }
}
