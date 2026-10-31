using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.ValueObjects;

namespace NexusPOS.CRM.Domain.Repositories;

public interface ICustomerRepository
{
    Task<Customer?> FindByIdAsync(CustomerId id, CancellationToken cancellationToken = default);
    Task<Customer?> FindByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Customer>> FindByTenantAsync(Guid tenantId, string? search, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<int> CountByTenantAsync(Guid tenantId, string? search, CancellationToken cancellationToken = default);
    Task<bool> ExistsByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default);

    // Another active customer of the tenant already has this phone (as stored by Customer), ignoring exceptId.
    Task<bool> ExistsActiveByPhoneAsync(Guid tenantId, string phone, CustomerId? exceptId = null, CancellationToken cancellationToken = default);
    void Add(Customer customer);
    void Update(Customer customer);
}
