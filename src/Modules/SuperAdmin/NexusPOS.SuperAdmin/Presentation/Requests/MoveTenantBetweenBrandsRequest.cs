namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record MoveTenantBetweenBrandsRequest(
    Guid TenantId,
    string? NewBranchDisplayName,
    string? NewBranchCode);
