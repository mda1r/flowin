namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record AddTenantToTaxScopeRequest(
    Guid TenantId,
    DateOnly EffectiveFrom);
