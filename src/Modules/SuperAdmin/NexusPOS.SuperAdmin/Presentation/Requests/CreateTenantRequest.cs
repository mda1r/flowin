namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record CreateTenantRequest(
    string Name,
    string Subdomain,
    string AdminEmail,
    string BusinessType,
    string Currency,
    string TimeZone);
