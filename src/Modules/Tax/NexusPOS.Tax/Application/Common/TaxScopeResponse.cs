namespace NexusPOS.Tax.Application.Common;

public sealed record TaxScopeResponse(
    Guid Id,
    string Name,
    string VatRegistrationNumber,
    string LegalEntityName,
    bool IsActive,
    DateTime CreatedAt,
    List<TaxScopeMemberResponse> Members);

public sealed record TaxScopeMemberResponse(
    Guid MembershipId,
    Guid TenantId,
    string TenantName,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo);
