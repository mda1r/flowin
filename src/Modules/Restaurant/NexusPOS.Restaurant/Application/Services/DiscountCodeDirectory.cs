using ErrorOr;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using Npgsql;

namespace NexusPOS.Restaurant.Application.Services;

internal sealed class DiscountCodeDirectory(RestaurantDbContext db, ILogger<DiscountCodeDirectory> logger) : IDiscountCodeDirectory
{
    public async Task<DiscountCodeLookup?> FindAsync(
        Guid tenantId, string code, DateTime? usableAt = null, CancellationToken cancellationToken = default)
    {
        string normalised = DiscountCode.Normalize(code);
        if (normalised.Length == 0)
        {
            return null;
        }

        try
        {
            DiscountCode? found = await db.DiscountCodes
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Code == normalised, cancellationToken);
            return found is null ? null : ToLookup(found, usableAt ?? DateTime.UtcNow);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            // This tenant never got the restaurant tables, so it has no codes.
            return null;
        }
    }

    // One UPDATE, so two tills redeeming the same code at once both count. The sale is already saved when this
    // runs, so a failure here is logged and never turns the sale into an error.
    public async Task<bool> RedeemAsync(Guid tenantId, string code, CancellationToken cancellationToken = default)
    {
        string normalised = DiscountCode.Normalize(code);
        try
        {
            int updated = await db.DiscountCodes
                .Where(c => c.TenantId == tenantId && c.Code == normalised)
                .ExecuteUpdateAsync(u => u.SetProperty(c => c.UsedCount, c => c.UsedCount + 1), cancellationToken);
            return updated > 0;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Could not count a use of discount code {Code} for tenant {TenantId}", normalised, tenantId);
            return false;
        }
    }

    internal static DiscountCodeLookup ToLookup(DiscountCode code, DateTime utcNow)
    {
        ErrorOr<Success> usable = code.CheckUsable(utcNow);
        return new DiscountCodeLookup(
            code.Code,
            code.Label,
            code.Type == DiscountCodeType.Percentage,
            code.Value,
            code.MinOrderAmount,
            usable.IsError ? usable.FirstError.Description : null);
    }
}
