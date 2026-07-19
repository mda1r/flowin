namespace NexusPOS.SharedKernel.Application.Messaging;

/// <summary>
/// Abstraction over the message transport. Stage 1: MediatR (in-process).
/// Stage 2+: MassTransit/RabbitMQ — swapped by DI registration, zero domain code changes.
/// </summary>
public interface IMessageBus
{
    Task PublishAsync<T>(T message, CancellationToken cancellationToken = default)
        where T : IIntegrationEvent;

    Task PublishBatchAsync<T>(IEnumerable<T> messages, CancellationToken cancellationToken = default)
        where T : IIntegrationEvent;
}
