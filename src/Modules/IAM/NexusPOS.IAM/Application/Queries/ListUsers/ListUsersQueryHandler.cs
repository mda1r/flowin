using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Queries.ListUsers;

internal sealed class ListUsersQueryHandler(IamDbContext db)
    : IQueryHandler<ListUsersQuery, List<UserSummaryResponse>>
{
    public async Task<ErrorOr<List<UserSummaryResponse>>> Handle(
        ListUsersQuery request,
        CancellationToken cancellationToken)
    {
        List<UserSummaryResponse> users = await db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == request.TenantId)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new UserSummaryResponse(
                u.Id.Value,
                u.Email.Value,
                u.FirstName,
                u.LastName,
                u.FirstName + " " + u.LastName,
                u.Roles.Select(r => r.ToString()).ToList(),
                u.IsActive,
                u.CreatedAt,
                u.LastLoginAt))
            .ToListAsync(cancellationToken);

        return users;
    }
}
