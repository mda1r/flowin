using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Organization.Domain.Entities;

public sealed class Brand : Entity<Guid>
{
    public string NameAr { get; private set; } = string.Empty;
    public string NameEn { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public string Status { get; private set; } = BrandStatus.Active;
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }

    public ICollection<TenantBrandMembership> Memberships { get; private set; } = [];

    private Brand() { }

    public static Brand Create(string nameAr, string nameEn, string code, Guid createdBy, string? notes = null)
    {
        return new Brand
        {
            Id = Guid.NewGuid(),
            NameAr = nameAr.Trim(),
            NameEn = nameEn.Trim(),
            Code = code.Trim().ToUpperInvariant(),
            Status = BrandStatus.Active,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void Update(string nameAr, string nameEn, string? notes)
    {
        NameAr = nameAr.Trim();
        NameEn = nameEn.Trim();
        Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status)
    {
        Status = status;
        UpdatedAt = DateTime.UtcNow;
    }
}

public static class BrandStatus
{
    public const string Active = "active";
    public const string Suspended = "suspended";
    public const string Archived = "archived";
}
