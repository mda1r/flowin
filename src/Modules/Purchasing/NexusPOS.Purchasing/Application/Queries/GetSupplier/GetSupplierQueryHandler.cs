using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.GetSupplier;

internal sealed class GetSupplierQueryHandler(ISupplierRepository supplierRepository)
    : IQueryHandler<GetSupplierQuery, SupplierResponse>
{
    public async Task<ErrorOr<SupplierResponse>> Handle(
        GetSupplierQuery request,
        CancellationToken cancellationToken)
    {
        Supplier? supplier = await supplierRepository.FindByIdAsync(
            new SupplierId(request.SupplierId), cancellationToken);

        if (supplier is null || supplier.TenantId != request.TenantId)
        {
            return PurchasingErrors.SupplierNotFound;
        }

        return PurchasingMapper.ToResponse(supplier);
    }
}
