namespace NexusPOS.Purchasing.Application.Common;

public sealed record SupplierResponse(
    Guid Id,
    Guid TenantId,
    string Name,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    bool IsActive,
    DateTime CreatedAt);
