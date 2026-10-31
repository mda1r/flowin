namespace NexusPOS.POS.Domain.Entities;

// Per-branch till rules: how far a cashier may discount alone, and the manager PIN that approves more.
public sealed class PosBranchSettings
{
    public const decimal DefaultMaxCashierDiscountPercent = 10m;
    // Five wrong PINs lock approvals for fifteen minutes, so a short PIN cannot be guessed by retrying.
    public const int MaxPinAttempts = 5;
    public static readonly TimeSpan PinLockout = TimeSpan.FromMinutes(15);

    public Guid BranchId { get; private set; }
    public Guid TenantId { get; private set; }
    public decimal MaxCashierDiscountPercent { get; private set; } = DefaultMaxCashierDiscountPercent;
    public string? ApprovalPinHash { get; private set; }
    public int FailedPinAttempts { get; private set; }
    public DateTime? PinLockedUntil { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private PosBranchSettings() { }

    public static PosBranchSettings Create(Guid tenantId, Guid branchId) => new()
    {
        TenantId = tenantId,
        BranchId = branchId,
        UpdatedAt = DateTime.UtcNow,
    };

    public void SetMaxCashierDiscount(decimal percent)
    {
        MaxCashierDiscountPercent = Math.Clamp(Math.Round(percent, 2), 0m, 100m);
        UpdatedAt = DateTime.UtcNow;
    }

    // Null clears the PIN, so nothing past the cap can be approved at the till.
    public void SetApprovalPinHash(string? pinHash)
    {
        ApprovalPinHash = pinHash;
        FailedPinAttempts = 0;
        PinLockedUntil = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
