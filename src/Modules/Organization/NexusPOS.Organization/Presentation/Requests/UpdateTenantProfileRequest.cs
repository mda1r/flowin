namespace NexusPOS.Organization.Presentation.Requests;

public sealed record UpdateTenantProfileRequest(
    string Name,
    string Currency,
    string TimeZone,
    string? LogoUrl,
    string? PhoneNumber,
    string? TaxId);
