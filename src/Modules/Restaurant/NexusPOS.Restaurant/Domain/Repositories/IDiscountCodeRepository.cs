using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Domain.Repositories;

public interface IDiscountCodeRepository
{
    Task<DiscountCode?> FindByCodeAsync(Guid tenantId, string code, CancellationToken cancellationToken = default);

    Task<DiscountCode?> FindByIdAsync(DiscountCodeId id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DiscountCode>> FindByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    void Add(DiscountCode discountCode);

    void Update(DiscountCode discountCode);
}
