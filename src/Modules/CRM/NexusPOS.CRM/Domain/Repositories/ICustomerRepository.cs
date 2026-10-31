using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.ValueObjects;

namespace NexusPOS.CRM.Domain.Repositories;

public interface ICustomerRepository
{
    Task<Customer?> FindByIdAsync(CustomerId id, CancellationToken cancellationToken = default);
    Task<Customer?> FindByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Customer>> FindByTenantAsync(Guid tenantId, string? search, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<bool> ExistsByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default);
    void Add(Customer customer);
    void Update(Customer customer);
}
