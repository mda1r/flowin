using NexusPOS.Organization.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Queries.ListBranches;

public sealed record ListBranchesQuery(Guid TenantId) : IQuery<IReadOnlyList<BranchResponse>>;
