using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Tax.Domain.Entities;

public sealed class TaxScopeMembership : Entity<Guid>
{
    public Guid TaxScopeId { get; private set; }
    public Guid TenantId { get; private set; }
    public DateOnly EffectiveFrom { get; private set; }
    public DateOnly? EffectiveTo { get; private set; }
    public DateTime AddedAt { get; private set; }
    public Guid AddedBy { get; private set; }
    public DateTime? RemovedAt { get; private set; }
    public Guid? RemovedBy { get; private set; }
    public string? RemovalReason { get; private set; }

    public TaxRegistrationScope? Scope { get; private set; }

    private TaxScopeMembership() { }

    public static TaxScopeMembership Create(
        Guid taxScopeId, Guid tenantId, DateOnly effectiveFrom, Guid addedBy)
    {
        return new TaxScopeMembership
        {
            Id = Guid.NewGuid(),
            TaxScopeId = taxScopeId,
            TenantId = tenantId,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = null,
            AddedAt = DateTime.UtcNow,
            AddedBy = addedBy,
        };
    }

    public void Remove(Guid removedBy, string? reason = null)
    {
        EffectiveTo = DateOnly.FromDateTime(DateTime.UtcNow);
        RemovedAt = DateTime.UtcNow;
        RemovedBy = removedBy;
        RemovalReason = reason?.Trim();
    }
}
