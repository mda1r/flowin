namespace NexusPOS.SharedKernel.Infrastructure.Outbox;

public sealed class OutboxMessage
{
    public Guid Id { get; private set; }
    public string EventType { get; private set; } = null!;
    public string AggregateType { get; private set; } = null!;
    public Guid AggregateId { get; private set; }
    public string Payload { get; private set; } = null!;
    public OutboxMessageStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public int RetryCount { get; private set; }
    public string? Error { get; private set; }

    private OutboxMessage() { }

    public static OutboxMessage Create(
        string eventType,
        string aggregateType,
        Guid aggregateId,
        string payload)
    {
        return new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventType = eventType,
            AggregateType = aggregateType,
            AggregateId = aggregateId,
            Payload = payload,
            Status = OutboxMessageStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            RetryCount = 0
        };
    }

    public void MarkPublished()
    {
        Status = OutboxMessageStatus.Published;
        PublishedAt = DateTime.UtcNow;
        Error = null;
    }

    public void MarkFailed(string error)
    {
        RetryCount++;
        Error = error;
        Status = RetryCount >= 5
            ? OutboxMessageStatus.Failed
            : OutboxMessageStatus.Pending;
    }
}

public enum OutboxMessageStatus
{
    Pending = 0,
    Published = 1,
    Failed = 2
}
