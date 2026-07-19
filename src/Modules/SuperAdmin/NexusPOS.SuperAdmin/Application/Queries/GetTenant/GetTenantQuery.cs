using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Queries.GetTenant;

public sealed record GetTenantQuery(Guid TenantId) : IQuery<TenantDetailResponse>;
