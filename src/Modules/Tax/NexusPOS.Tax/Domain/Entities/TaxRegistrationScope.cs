using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Tax.Domain.Entities;

public sealed class TaxRegistrationScope : Entity<Guid>
{
    public Guid? BrandId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string VatRegistrationNumber { get; private set; } = string.Empty;
    public string LegalEntityName { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }

    public ICollection<TaxScopeMembership> Memberships { get; private set; } = [];

    private TaxRegistrationScope() { }

    public static TaxRegistrationScope Create(
        Guid? brandId,
        string name,
        string vatRegistrationNumber,
        string legalEntityName,
        Guid createdBy)
    {
        return new TaxRegistrationScope
        {
            Id = Guid.NewGuid(),
            BrandId = brandId,
            Name = name.Trim(),
            VatRegistrationNumber = vatRegistrationNumber.Trim(),
            LegalEntityName = legalEntityName.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void Update(string name, string vatRegistrationNumber, string legalEntityName)
    {
        Name = name.Trim();
        VatRegistrationNumber = vatRegistrationNumber.Trim();
        LegalEntityName = legalEntityName.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }
}
