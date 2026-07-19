using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.GetSupplier;

public sealed record GetSupplierQuery(Guid SupplierId, Guid TenantId) : IQuery<SupplierResponse>;
