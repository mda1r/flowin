using NexusPOS.IAM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Queries.ListUsers;

public sealed record ListUsersQuery(Guid TenantId) : IQuery<List<UserSummaryResponse>>;
