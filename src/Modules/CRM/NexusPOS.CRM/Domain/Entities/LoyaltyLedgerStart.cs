namespace NexusPOS.CRM.Domain.Entities;

// When the points ledger began for this store: one row, written once by the database initializer. Sales completed
// before it have no ledger rows, so only those are refunded by the programme's rules instead of their own rows.
public sealed class LoyaltyLedgerStart
{
    public const int SingletonId = 1;

    public int Id { get; private set; }
    public DateTime StartedAt { get; private set; }

    private LoyaltyLedgerStart() { }

    public static LoyaltyLedgerStart Create(DateTime startedAt) => new() { Id = SingletonId, StartedAt = startedAt };
}
