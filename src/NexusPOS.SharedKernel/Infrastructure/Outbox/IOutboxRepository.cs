namespace NexusPOS.SharedKernel.Infrastructure.Outbox;

public interface IOutboxRepository
{
    Task AddAsync(OutboxMessage message, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OutboxMessage>> GetPendingAsync(
        int batchSize = 50,
        CancellationToken cancellationToken = default);

    Task UpdateAsync(OutboxMessage message, CancellationToken cancellationToken = default);

    Task UpdateBatchAsync(IEnumerable<OutboxMessage> messages, CancellationToken cancellationToken = default);
}
