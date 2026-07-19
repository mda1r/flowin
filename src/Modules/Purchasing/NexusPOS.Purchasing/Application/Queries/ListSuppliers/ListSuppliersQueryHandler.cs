using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.ListSuppliers;

internal sealed class ListSuppliersQueryHandler(ISupplierRepository supplierRepository)
    : IQueryHandler<ListSuppliersQuery, IReadOnlyList<SupplierResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<SupplierResponse>>> Handle(
        ListSuppliersQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.Supplier> suppliers = await supplierRepository.FindByTenantAsync(
            request.TenantId, request.Page, request.PageSize, cancellationToken);

        return suppliers.Select(PurchasingMapper.ToResponse).ToList();
    }
}
