using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Queries.ListTenants;

public sealed record ListTenantsQuery : IQuery<List<TenantWithSubscriptionResponse>>;
