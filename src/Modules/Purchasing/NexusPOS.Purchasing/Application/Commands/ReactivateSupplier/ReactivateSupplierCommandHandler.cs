using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.Purchasing.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.ReactivateSupplier;

internal sealed class ReactivateSupplierCommandHandler(
    ISupplierRepository supplierRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<ReactivateSupplierCommand, SupplierResponse>
{
    public async Task<ErrorOr<SupplierResponse>> Handle(
        ReactivateSupplierCommand request,
        CancellationToken cancellationToken)
    {
        Supplier? supplier = await supplierRepository.FindByIdAsync(
            new SupplierId(request.SupplierId), cancellationToken);

        if (supplier is null || supplier.TenantId != request.TenantId)
        {
            return PurchasingErrors.SupplierNotFound;
        }

        supplier.Activate();

        supplierRepository.Update(supplier);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(supplier);
    }
}
