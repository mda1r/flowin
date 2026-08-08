using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Domain.Entities;

public sealed class ActivityLog : Entity<ActivityLogId>
{
    public Guid? BranchId { get; private set; }
    public Guid UserId { get; private set; }
    public string UserName { get; private set; } = string.Empty;
    public string? UserEmail { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string? Details { get; private set; }
    public DateTime OccurredAt { get; private set; }

    private ActivityLog() { }

    public static ActivityLog Create(
        Guid? branchId,
        Guid userId,
        string userName,
        string? userEmail,
        string category,
        string action,
        string? details,
        DateTime occurredAt)
    {
        return new ActivityLog
        {
            Id = new ActivityLogId(Guid.NewGuid()),
            BranchId = branchId,
            UserId = userId,
            UserName = userName,
            UserEmail = userEmail,
            Category = category,
            Action = action,
            Details = details,
            OccurredAt = occurredAt,
        };
    }
}
