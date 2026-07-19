using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Application.Common;

public sealed record MenuItemResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    MenuCategory Category,
    string Name,
    string Description,
    decimal Price,
    string Currency,
    bool IsAvailable,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt);
