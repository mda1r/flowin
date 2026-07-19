namespace NexusPOS.Organization.Presentation.Requests;

public sealed record CreateTenantRequest(
    string Name,
    string Subdomain,
    string AdminEmail,
    string Currency = "USD",
    string TimeZone = "UTC");
