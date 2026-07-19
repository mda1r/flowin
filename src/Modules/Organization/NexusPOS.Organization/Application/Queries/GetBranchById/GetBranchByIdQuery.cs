using NexusPOS.Organization.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Queries.GetBranchById;

public sealed record GetBranchByIdQuery(Guid BranchId, Guid TenantId) : IQuery<BranchResponse>;
