using NexusPOS.Tax.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Common;

public sealed record BrandResponse(
    Guid Id,
    string NameAr,
    string NameEn,
    string Code,
    string Status,
    string? Notes,
    int MemberCount,
    DateTime CreatedAt);

public sealed record BrandDetailResponse(
    Guid Id,
    string NameAr,
    string NameEn,
    string Code,
    string Status,
    string? Notes,
    int MemberCount,
    DateTime CreatedAt,
    List<BrandMemberResponse> Members,
    List<TaxScopeResponse> TaxScopes);

public sealed record BrandMemberResponse(
    Guid MembershipId,
    Guid TenantId,
    string TenantName,
    string TenantEmail,
    string BusinessType,
    bool TenantIsActive,
    string? BranchDisplayName,
    string? BranchCode,
    string MembershipStatus,
    DateTime LinkedAt);
