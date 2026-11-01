namespace NexusPOS.SharedKernel.Application.Services;

// Lets the till apply an owner's discount code without referencing the Restaurant module, which keeps the codes.
public interface IDiscountCodeDirectory
{
    // The tenant's code with this text (trimmed, any letter case), or null when there is none.
    Task<DiscountCodeLookup?> FindAsync(Guid tenantId, string code, CancellationToken cancellationToken = default);

    // Counts one use of the code for a sale that has been saved. False when the code is no longer there.
    Task<bool> RedeemAsync(Guid tenantId, string code, CancellationToken cancellationToken = default);
}

// Code is the stored form (upper case). Value is a percentage when IsPercentage, otherwise an amount with VAT included.
// Problem is null when the code can be used now; otherwise the reason it cannot (switched off, expired, used up).
// MinOrderAmount is the bill, VAT included, below which the code does not apply; 0 means any bill.
public sealed record DiscountCodeLookup(
    string Code,
    string? Label,
    bool IsPercentage,
    decimal Value,
    decimal MinOrderAmount,
    string? Problem);
