using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Purchasing.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Application.Commands.CreateSupplier;

internal sealed class CreateSupplierCommandHandler(
    ISupplierRepository supplierRepository,
    PurchasingDbContext dbContext)
    : ICommandHandler<CreateSupplierCommand, SupplierResponse>
{
    public async Task<ErrorOr<SupplierResponse>> Handle(
        CreateSupplierCommand request,
        CancellationToken cancellationToken)
    {
        bool nameExists = await supplierRepository.ExistsByNameAsync(
            request.TenantId, request.Name, cancellationToken);

        if (nameExists)
        {
            return PurchasingErrors.SupplierNameTaken;
        }

        Supplier supplier = Supplier.Create(
            request.TenantId, request.Name, request.ContactEmail, request.ContactPhone, request.Address);

        supplierRepository.Add(supplier);
        await dbContext.SaveChangesAsync(cancellationToken);

        return PurchasingMapper.ToResponse(supplier);
    }
}
