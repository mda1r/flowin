using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.ListSuppliers;

public sealed record ListSuppliersQuery(Guid TenantId, int Page = 1, int PageSize = 20) : IQuery<IReadOnlyList<SupplierResponse>>;
