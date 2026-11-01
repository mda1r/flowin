using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Repositories;

internal sealed class DiscountCodeRepository(RestaurantDbContext dbContext) : IDiscountCodeRepository
{
    public async Task<DiscountCode?> FindByCodeAsync(
        Guid tenantId,
        string code,
        CancellationToken cancellationToken = default)
    {
        string normalised = DiscountCode.Normalize(code);
        return await dbContext.DiscountCodes
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Code == normalised, cancellationToken);
    }

    public async Task<DiscountCode?> FindByIdAsync(
        DiscountCodeId id,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.DiscountCodes
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<DiscountCode>> FindByTenantAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.DiscountCodes
            .Where(c => c.TenantId == tenantId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public Task<bool> ExistsAsync(
        Guid tenantId,
        string code,
        DiscountCodeId? exceptId,
        CancellationToken cancellationToken = default)
    {
        string normalised = DiscountCode.Normalize(code);
        IQueryable<DiscountCode> same = dbContext.DiscountCodes.Where(c => c.TenantId == tenantId && c.Code == normalised);
        return exceptId is null
            ? same.AnyAsync(cancellationToken)
            : same.AnyAsync(c => c.Id != exceptId, cancellationToken);
    }

    public void Add(DiscountCode discountCode) => dbContext.DiscountCodes.Add(discountCode);

    public void Update(DiscountCode discountCode) => dbContext.DiscountCodes.Update(discountCode);

    public void Remove(DiscountCode discountCode) => dbContext.DiscountCodes.Remove(discountCode);
}
