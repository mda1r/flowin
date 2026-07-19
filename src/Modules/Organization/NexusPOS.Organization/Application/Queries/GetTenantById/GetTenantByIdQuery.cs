using NexusPOS.Organization.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Queries.GetTenantById;

public sealed record GetTenantByIdQuery(Guid TenantId) : IQuery<TenantResponse>;
