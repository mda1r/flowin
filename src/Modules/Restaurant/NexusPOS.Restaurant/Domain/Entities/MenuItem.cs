using ErrorOr;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Events;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Restaurant.Domain.Entities;

public sealed class MenuItem : AggregateRoot<MenuItemId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public MenuCategory Category { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public bool IsAvailable { get; private set; }
    public int SortOrder { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private MenuItem() { }

    public static ErrorOr<MenuItem> Create(
        Guid tenantId,
        Guid branchId,
        MenuCategory category,
        string name,
        string description,
        decimal price,
        string currency,
        int sortOrder)
    {
        if (price <= 0)
        {
            return RestaurantErrors.InvalidPrice;
        }

        MenuItem menuItem = new()
        {
            Id = new MenuItemId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            Category = category,
            Name = name.Trim(),
            Description = description.Trim(),
            Price = price,
            Currency = currency.Trim().ToUpperInvariant(),
            IsAvailable = true,
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        menuItem.RaiseDomainEvent(new MenuItemCreatedDomainEvent(
            menuItem.Id.Value, tenantId, branchId, menuItem.Name, price));

        return menuItem;
    }

    public ErrorOr<Success> Update(
        MenuCategory category,
        string name,
        string description,
        decimal price,
        int sortOrder)
    {
        if (price <= 0)
        {
            return RestaurantErrors.InvalidPrice;
        }

        Category = category;
        Name = name.Trim();
        Description = description.Trim();
        Price = price;
        SortOrder = sortOrder;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public void SetAvailability(bool available)
    {
        IsAvailable = available;
        UpdatedAt = DateTime.UtcNow;
    }
}
