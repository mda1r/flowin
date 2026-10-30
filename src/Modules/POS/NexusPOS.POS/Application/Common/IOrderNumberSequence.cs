namespace NexusPOS.POS.Application.Common;

// Hands out the store's next invoice number. Atomic, so two tills completing at once never share a number.
public interface IOrderNumberSequence
{
    Task<long> NextAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
