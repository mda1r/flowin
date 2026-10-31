using MediatR;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Application.EventHandlers;

// Writes the audit entry for a staff-account change. It carries no branch, so it shows in every branch's log.
// Exceptions propagate on purpose: IAM saves the change only after this succeeds, so no change goes unlogged.
internal sealed class StaffAccountChangedActivityLogHandler(PosDbContext db)
    : INotificationHandler<StaffAccountChangedDomainEvent>
{
    public async Task Handle(StaffAccountChangedDomainEvent notification, CancellationToken cancellationToken)
    {
        db.ActivityLogs.Add(ActivityLog.Create(
            null,
            notification.ActorUserId,
            notification.ActorName,
            notification.ActorEmail,
            "user",
            notification.Action,
            notification.Details,
            notification.OccurredAt));

        await db.SaveChangesAsync(cancellationToken);
    }
}
