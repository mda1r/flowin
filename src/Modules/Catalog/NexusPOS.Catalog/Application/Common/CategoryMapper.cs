using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.Application.Common;

internal static class CategoryMapper
{
    public static CategoryResponse ToResponse(Category c) => new(
        c.Id.Value, c.Name, c.Description, c.ParentId?.Value, c.IsActive, c.SortOrder, c.CreatedAt, c.NameEn);
}
