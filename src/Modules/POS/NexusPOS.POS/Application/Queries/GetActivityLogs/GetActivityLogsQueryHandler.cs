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
    public async Task<ErrorOr<IReadOnlyList<ActivityLogResponse>>> Handle(
        GetActivityLogsQuery request,
        CancellationToken cancellationToken)
    {
        IQueryable<ActivityLog> query = dbContext.ActivityLogs.AsNoTracking();

        if (request.BranchId.HasValue)
        {
            query = query.Where(l => l.BranchId == request.BranchId);
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

        List<ActivityLog> logs = await query
            .OrderByDescending(l => l.OccurredAt)
            .Take(request.PageSize > 0 ? request.PageSize : 200)
            .ToListAsync(cancellationToken);

        return logs.Select(LogActivityCommandHandler.ToResponse).ToList();
    }
}
