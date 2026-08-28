using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Organization.Domain.Entities;

public sealed class TenantBrandMembership : Entity<Guid>
{
    public Guid BrandId { get; private set; }
    public Guid TenantId { get; private set; }
    public string? BranchDisplayName { get; private set; }
    public string? BranchCode { get; private set; }
    public string Status { get; private set; } = MembershipStatus.Active;
    public DateTime LinkedAt { get; private set; }
    public Guid LinkedBy { get; private set; }
    public DateTime? UnlinkedAt { get; private set; }
    public Guid? UnlinkedBy { get; private set; }

    public Brand? Brand { get; private set; }

    private TenantBrandMembership() { }

    public static TenantBrandMembership Create(
        Guid brandId, Guid tenantId, Guid linkedBy,
        string? branchDisplayName = null, string? branchCode = null)
    {
        return new TenantBrandMembership
        {
            Id = Guid.NewGuid(),
            BrandId = brandId,
            TenantId = tenantId,
            BranchDisplayName = branchDisplayName?.Trim(),
            BranchCode = branchCode?.Trim(),
            Status = MembershipStatus.Active,
            LinkedAt = DateTime.UtcNow,
            LinkedBy = linkedBy,
        };
    }

    public void Unlink(Guid unlinkedBy)
    {
        UnlinkedAt = DateTime.UtcNow;
        UnlinkedBy = unlinkedBy;
        Status = MembershipStatus.Unlinked;
    }

    public void UpdateDisplay(string? displayName, string? code)
    {
        BranchDisplayName = displayName?.Trim();
        BranchCode = code?.Trim();
    }
}

public static class MembershipStatus
{
    public const string Active = "active";
    public const string Unlinked = "unlinked";
}
