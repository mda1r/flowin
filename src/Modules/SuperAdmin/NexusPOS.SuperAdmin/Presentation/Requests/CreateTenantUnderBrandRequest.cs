namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record CreateTenantUnderBrandRequest(
    string Name,
    string Subdomain,
    string AdminEmail,
    string BusinessType,
    string Currency,
    string TimeZone,
    string? BranchDisplayName,
    string? BranchCode);
