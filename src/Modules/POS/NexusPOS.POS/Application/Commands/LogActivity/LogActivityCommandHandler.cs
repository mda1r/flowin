using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.LogActivity;

internal sealed class LogActivityCommandHandler(PosDbContext dbContext)
    : ICommandHandler<LogActivityCommand, ActivityLogResponse>
{
    public async Task<ErrorOr<ActivityLogResponse>> Handle(
        LogActivityCommand request,
        CancellationToken cancellationToken)
    {
        ActivityLog log = ActivityLog.Create(
            request.BranchId,
            request.UserId,
            request.UserName,
            request.UserEmail,
            request.Category,
            request.Action,
            request.Details,
            request.OccurredAt);

        dbContext.ActivityLogs.Add(log);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToResponse(log);
    }

    internal static ActivityLogResponse ToResponse(ActivityLog l) => new(
        l.Id.Value.ToString(),
        l.OccurredAt.ToString("O"),
        l.UserId.ToString(),
        l.UserName,
        l.UserEmail,
        l.Category,
        l.Action,
        l.Details,
        l.BranchId?.ToString());
}
