namespace NexusPOS.SuperAdmin.Domain.Entities;

public sealed class BrandAuditLog
{
    public Guid Id { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public Guid? BrandId { get; private set; }
    public Guid? TenantId { get; private set; }
    public Guid? TaxScopeId { get; private set; }
    public Guid ActorId { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public string? BeforeJson { get; private set; }
    public string? AfterJson { get; private set; }
    public string? Reason { get; private set; }

    private BrandAuditLog() { }

    public static BrandAuditLog Record(
        string eventType, Guid actorId,
        Guid? brandId = null, Guid? tenantId = null, Guid? taxScopeId = null,
        string? beforeJson = null, string? afterJson = null, string? reason = null)
    {
        return new BrandAuditLog
        {
            Id = Guid.NewGuid(),
            EventType = eventType,
            BrandId = brandId,
            TenantId = tenantId,
            TaxScopeId = taxScopeId,
            ActorId = actorId,
            OccurredAt = DateTime.UtcNow,
            BeforeJson = beforeJson,
            AfterJson = afterJson,
            Reason = reason,
        };
    }
}

public static class BrandAuditEvents
{
    public const string BrandCreated = "BrandCreated";
    public const string BrandUpdated = "BrandUpdated";
    public const string BrandStatusChanged = "BrandStatusChanged";
    public const string TenantLinkedToBrand = "TenantLinkedToBrand";
    public const string TenantUnlinkedFromBrand = "TenantUnlinkedFromBrand";
    public const string TenantMovedBetweenBrands = "TenantMovedBetweenBrands";
    public const string BranchAccountCreatedUnderBrand = "BranchAccountCreatedUnderBrand";
    public const string TaxScopeCreated = "TaxScopeCreated";
    public const string TaxScopeUpdated = "TaxScopeUpdated";
    public const string TenantAddedToTaxScope = "TenantAddedToTaxScope";
    public const string TenantRemovedFromTaxScope = "TenantRemovedFromTaxScope";
}
