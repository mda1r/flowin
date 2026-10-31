using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Purchasing.Domain.Entities;

public sealed class Supplier : AggregateRoot<SupplierId>
{
    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? ContactEmail { get; private set; }
    public string? ContactPhone { get; private set; }
    public string? Address { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Supplier() { }

    public static Supplier Create(Guid tenantId, string name, string? contactEmail = null, string? contactPhone = null, string? address = null)
    {
        return new Supplier
        {
            Id = new SupplierId(Guid.NewGuid()),
            TenantId = tenantId,
            Name = name.Trim(),
            ContactEmail = contactEmail?.Trim(),
            ContactPhone = contactPhone?.Trim(),
            Address = address?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void UpdateDetails(string name, string? contactEmail, string? contactPhone, string? address)
    {
        Name = name.Trim();
        ContactEmail = contactEmail?.Trim();
        ContactPhone = contactPhone?.Trim();
        Address = address?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
