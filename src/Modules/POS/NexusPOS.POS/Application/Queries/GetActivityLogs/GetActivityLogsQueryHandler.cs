using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Commands.LogActivity;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.GetActivityLogs;

internal sealed class GetActivityLogsQueryHandler(PosDbContext dbContext)
    : IQueryHandler<GetActivityLogsQuery, IReadOnlyList<ActivityLogResponse>>
{
    internal const int MaxPageSize = 500;
    internal const int DefaultPageSize = 200;

    public async Task<ErrorOr<IReadOnlyList<ActivityLogResponse>>> Handle(
        GetActivityLogsQuery request,
        CancellationToken cancellationToken)
    {
        List<ActivityLog> logs = await Apply(dbContext.ActivityLogs.AsNoTracking(), request)
            .ToListAsync(cancellationToken);

        return logs.Select(LogActivityCommandHandler.ToResponse).ToList();
    }

    /// <summary>Filters, orders (newest first) and pages the log rows.</summary>
    internal static IQueryable<ActivityLog> Apply(IQueryable<ActivityLog> query, GetActivityLogsQuery request)
    {
        if (request.BranchId.HasValue)
        {
            // Tenant-wide entries (user management, settings) carry no branch; show them in every branch.
            query = query.Where(l => l.BranchId == request.BranchId || l.BranchId == null);
        }

        if (!string.IsNullOrEmpty(request.Category))
        {
            query = query.Where(l => l.Category == request.Category);
        }

        if (request.From.HasValue)
        {
            query = query.Where(l => l.OccurredAt >= request.From.Value);
        }

        if (request.To.HasValue)
        {
            query = query.Where(l => l.OccurredAt <= request.To.Value);
        }

        int pageSize = request.PageSize > 0 ? Math.Min(request.PageSize, MaxPageSize) : DefaultPageSize;

        return query
            .OrderByDescending(l => l.OccurredAt)
            .Skip(Math.Max(request.Skip, 0))
            .Take(pageSize);
    }
}
