namespace NexusPOS.CRM.Domain.Entities;

public enum LoyaltyTransactionKind
{
    Earn,
    Redeem,
    Adjust,
    Reverse,
}

// One change to a customer's points balance: earned or spent on a sale, set by a manager, or reversed by a refund.
// Rows are never edited, so the balance can always be explained and every manual change names who made it.
public sealed class LoyaltyTransaction
{
    public const int MaxReasonLength = 256;

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid CustomerId { get; private set; }

    // Signed: positive adds points, negative takes them away.
    public int Delta { get; private set; }
    public LoyaltyTransactionKind Kind { get; private set; }
    public Guid? OrderId { get; private set; }
    public Guid? UserId { get; private set; }
    public string? Reason { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private LoyaltyTransaction() { }

    public static LoyaltyTransaction Create(
        Guid tenantId,
        Guid customerId,
        int delta,
        LoyaltyTransactionKind kind,
        Guid? orderId = null,
        Guid? userId = null,
        string? reason = null)
    {
        string? note = Customer.Clean(reason);
        return new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customerId,
            Delta = delta,
            Kind = kind,
            OrderId = orderId,
            UserId = userId,
            Reason = note is { Length: > MaxReasonLength } ? note[..MaxReasonLength] : note,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
