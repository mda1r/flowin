using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.CRM.Domain.ValueObjects;

namespace NexusPOS.CRM.Infrastructure.Persistence.Repositories;

internal sealed class CustomerRepository(CrmDbContext dbContext) : ICustomerRepository
{
    public async Task<Customer?> FindByIdAsync(CustomerId id, CancellationToken cancellationToken = default)
        => await dbContext.Customers
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<Customer?> FindByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default)
        => await dbContext.Customers
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Email == email, cancellationToken);

    public async Task<IReadOnlyList<Customer>> FindByTenantAsync(
        Guid tenantId, string? search, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        IQueryable<Customer> query = dbContext.Customers
            .Where(c => c.TenantId == tenantId && c.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            string trimmed = search.Trim();
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, $"%{trimmed}%") ||
                (c.Email != null && EF.Functions.ILike(c.Email, $"%{trimmed}%")) ||
                (c.Phone != null && c.Phone.Contains(trimmed)));
        }

        return await query
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ExistsByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default)
    {
        string trimmed = email.Trim();
        return await dbContext.Customers
            .AnyAsync(c => c.TenantId == tenantId && EF.Functions.ILike(c.Email!, trimmed), cancellationToken);
    }

    public void Add(Customer customer) => dbContext.Customers.Add(customer);

    public void Update(Customer customer) => dbContext.Customers.Update(customer);
}
