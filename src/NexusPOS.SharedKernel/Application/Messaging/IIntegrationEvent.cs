namespace NexusPOS.SharedKernel.Application.Messaging;

/// <summary>
/// Marker interface for integration events sent across bounded context boundaries
/// via the Outbox pattern → RabbitMQ. All implementations use the CloudEvents envelope.
/// </summary>
public interface IIntegrationEvent
{
    Guid EventId { get; }
    string EventType { get; }
    string EventVersion { get; }
    DateTime OccurredAt { get; }
    string TenantId { get; }
}

public abstract record IntegrationEvent : IIntegrationEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public abstract string EventType { get; }
    public virtual string EventVersion => "1.0";
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
    public string TenantId { get; init; } = string.Empty;
}
