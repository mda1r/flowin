namespace NexusPOS.Catalog.Presentation.Requests;

public sealed record CreateCategoryRequest(
    string Name,
    string? Description = null,
    Guid? ParentId = null,
    int SortOrder = 0);
