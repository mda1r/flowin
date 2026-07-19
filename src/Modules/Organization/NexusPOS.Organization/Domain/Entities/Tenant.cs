using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.Events;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Organization.Domain.Entities;

public sealed class Tenant : AggregateRoot<TenantId>
{
    public string Name { get; private set; } = null!;
    public string Subdomain { get; private set; } = null!;
    public string AdminEmail { get; private set; } = null!;
    public SubscriptionPlan Plan { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? SuspendedAt { get; private set; }
    public string? LogoUrl { get; private set; }
    public string? PhoneNumber { get; private set; }
    public Address? Address { get; private set; }
    public string? TaxId { get; private set; }
    public string Currency { get; private set; } = null!;
    public string TimeZone { get; private set; } = null!;
    public BusinessType BusinessType { get; private set; }

    private Tenant() { }

    public static Tenant Create(
        string name,
        string subdomain,
        string adminEmail,
        string currency = "USD",
        string timeZone = "UTC",
        BusinessType businessType = BusinessType.Retail)
    {
        Tenant tenant = new()
        {
            Id = new TenantId(Guid.NewGuid()),
            Name = name.Trim(),
            Subdomain = subdomain.Trim().ToLowerInvariant(),
            AdminEmail = adminEmail.Trim().ToLowerInvariant(),
            Plan = SubscriptionPlan.Free,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Currency = currency.Trim().ToUpperInvariant(),
            TimeZone = timeZone,
            BusinessType = businessType,
        };

        tenant.RaiseDomainEvent(new TenantCreatedDomainEvent(tenant.Id.Value, tenant.Name, tenant.Subdomain));

        return tenant;
    }

    public void UpdateProfile(
        string name,
        string currency,
        string timeZone,
        string? logoUrl,
        string? phoneNumber,
        string? taxId)
    {
        Name = name.Trim();
        Currency = currency.Trim().ToUpperInvariant();
        TimeZone = timeZone.Trim();
        LogoUrl = logoUrl?.Trim();
        PhoneNumber = phoneNumber?.Trim();
        TaxId = taxId?.Trim();
    }

    public void Upgrade(SubscriptionPlan newPlan)
    {
        Plan = newPlan;
    }

    public void Suspend()
    {
        IsActive = false;
        SuspendedAt = DateTime.UtcNow;
        RaiseDomainEvent(new TenantSuspendedDomainEvent(Id.Value, Name));
    }

    public void Reinstate()
    {
        IsActive = true;
        SuspendedAt = null;
    }

    public static Tenant CreateWithId(
        Guid id,
        string name,
        string subdomain,
        string adminEmail,
        string currency = "SAR",
        string timeZone = "Asia/Riyadh",
        BusinessType businessType = BusinessType.Retail)
    {
        return new Tenant
        {
            Id = new TenantId(id),
            Name = name.Trim(),
            Subdomain = subdomain.Trim().ToLowerInvariant(),
            AdminEmail = adminEmail.Trim().ToLowerInvariant(),
            Plan = SubscriptionPlan.Enterprise,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Currency = currency.Trim().ToUpperInvariant(),
            TimeZone = timeZone,
            BusinessType = businessType,
        };
    }
}
