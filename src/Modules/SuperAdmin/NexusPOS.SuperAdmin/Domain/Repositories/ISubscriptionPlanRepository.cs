using NexusPOS.SuperAdmin.Domain.Entities;

namespace NexusPOS.SuperAdmin.Domain.Repositories;

public interface ISubscriptionPlanRepository
{
    Task<List<SubscriptionPlan>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<SubscriptionPlan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    void Add(SubscriptionPlan plan);
}
