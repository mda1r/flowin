using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Marketing;
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
        CustomerSearch? terms = Parse(search);
        IQueryable<Customer> query = Matching(tenantId, terms);
        IOrderedQueryable<Customer> ordered = terms is null
            ? query.OrderBy(c => c.Name)
            : terms.ExactPhoneFirst(query);

        return await ordered
            .ThenBy(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> CountByTenantAsync(Guid tenantId, string? search, CancellationToken cancellationToken = default)
        => await Matching(tenantId, Parse(search)).CountAsync(cancellationToken);

    private static CustomerSearch? Parse(string? search) =>
        string.IsNullOrWhiteSpace(search) ? null : CustomerSearch.Parse(search);

    // The active customers the list and its count both see for a search. A phone matches on the raw text, as before,
    // and on its digits in 0-9 and in the stored form, so 05…, +966… and Arabic-Indic digits all find the same row.
    private IQueryable<Customer> Matching(Guid tenantId, CustomerSearch? terms)
    {
        IQueryable<Customer> query = dbContext.Customers
            .Where(c => c.TenantId == tenantId && c.IsActive);

        if (terms is not null)
        {
            string trimmed = terms.Text;
            string digits = terms.Digits;
            string key = terms.Key;
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, $"%{trimmed}%") ||
                (c.Email != null && EF.Functions.ILike(c.Email, $"%{trimmed}%")) ||
                (c.Phone != null && (c.Phone.Contains(trimmed) || c.Phone.Contains(digits) || c.Phone.Contains(key))));
        }

        return query;
    }

    public async Task<bool> ExistsByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default)
    {
        string trimmed = email.Trim();
        return await dbContext.Customers
            .AnyAsync(c => c.TenantId == tenantId && EF.Functions.ILike(c.Email!, trimmed), cancellationToken);
    }

    public async Task<bool> ExistsActiveByPhoneAsync(
        Guid tenantId, string phone, CustomerId? exceptId = null, CancellationToken cancellationToken = default)
    {
        // Older rows may hold the same number in another form (05…, +966…), so every stored form counts.
        string[] forms = WhatsAppPhone.Normalize(phone) is string normalized
            ? [.. WhatsAppPhone.StoredForms(normalized)]
            : [phone.Trim()];

        IQueryable<Customer> query = dbContext.Customers
            .Where(c => c.TenantId == tenantId && c.IsActive && c.Phone != null && forms.Contains(c.Phone));
        if (exceptId is not null)
        {
            query = query.Where(c => c.Id != exceptId);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public void Add(Customer customer) => dbContext.Customers.Add(customer);

    public void Update(Customer customer) => dbContext.Customers.Update(customer);
}
