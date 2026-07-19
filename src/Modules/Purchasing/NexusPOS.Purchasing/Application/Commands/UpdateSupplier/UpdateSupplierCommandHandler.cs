using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.UpdateSupplier;

internal sealed class UpdateSupplierCommandHandler(
    ISupplierRepository supplierRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<UpdateSupplierCommand, SupplierResponse>
{
    public async Task<ErrorOr<SupplierResponse>> Handle(
        UpdateSupplierCommand request,
        CancellationToken cancellationToken)
    {
        Supplier? supplier = await supplierRepository.FindByIdAsync(
            new SupplierId(request.SupplierId), cancellationToken);

        if (supplier is null || supplier.TenantId != request.TenantId)
        {
            return PurchasingErrors.SupplierNotFound;
        }

        bool nameConflict = await supplierRepository.ExistsByNameAsync(
            request.TenantId, request.Name, cancellationToken);

        if (nameConflict && !supplier.Name.Equals(request.Name, StringComparison.OrdinalIgnoreCase))
        {
            return PurchasingErrors.SupplierNameTaken;
        }

        supplier.UpdateDetails(request.Name, request.ContactEmail, request.ContactPhone, request.Address);

        supplierRepository.Update(supplier);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(supplier);
    }
}
