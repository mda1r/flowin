using NexusPOS.Catalog.Domain.Events;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Catalog.Domain.Entities;

public sealed class Category : AggregateRoot<CategoryId>
{
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public CategoryId? ParentId { get; private set; }
    public bool IsActive { get; private set; }
    public int SortOrder { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private Category() { }

    public static Category Create(string name, string? description = null, CategoryId? parentId = null, int sortOrder = 0)
    {
        Category category = new()
        {
            Id = new CategoryId(Guid.NewGuid()),
            Name = name.Trim(),
            Description = description?.Trim(),
            ParentId = parentId,
            IsActive = true,
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
        };

        category.RaiseDomainEvent(new CategoryCreatedDomainEvent(category.Id.Value, category.Name));

        return category;
    }

    public void Update(string name, string? description, int sortOrder)
    {
        Name = name.Trim();
        Description = description?.Trim();
        SortOrder = sortOrder;
    }

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;
}
