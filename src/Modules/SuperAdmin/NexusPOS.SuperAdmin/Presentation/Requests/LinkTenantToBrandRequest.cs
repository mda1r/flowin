namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record LinkTenantToBrandRequest(
    Guid TenantId,
    string? BranchDisplayName,
    string? BranchCode);
