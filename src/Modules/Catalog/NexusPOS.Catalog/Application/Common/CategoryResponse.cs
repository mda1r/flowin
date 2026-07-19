namespace NexusPOS.Catalog.Application.Common;

public sealed record CategoryResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid? ParentId,
    bool IsActive,
    int SortOrder,
    DateTime CreatedAt);
