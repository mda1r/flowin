using ErrorOr;
using FluentAssertions;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Domain;

public sealed class MenuItemTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private static ErrorOr<MenuItem> CreateValidMenuItem(
        decimal price = 9.99m,
        int sortOrder = 1) =>
        MenuItem.Create(
            _tenantId, _branchId, MenuCategory.Mains,
            "Grilled Chicken", "Tender grilled chicken breast",
            price, "SAR", sortOrder);

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidArgs_CreatesMenuItemWithCorrectProperties()
    {
        ErrorOr<MenuItem> result = CreateValidMenuItem();

        result.IsError.Should().BeFalse();
        result.Value.TenantId.Should().Be(_tenantId);
        result.Value.BranchId.Should().Be(_branchId);
        result.Value.Category.Should().Be(MenuCategory.Mains);
        result.Value.Name.Should().Be("Grilled Chicken");
        result.Value.Price.Should().Be(9.99m);
        result.Value.Currency.Should().Be("SAR");
        result.Value.SortOrder.Should().Be(1);
    }

    [Fact]
    public void Create_WithValidArgs_SetsIsAvailableToTrue()
    {
        ErrorOr<MenuItem> result = CreateValidMenuItem();

        result.IsError.Should().BeFalse();
        result.Value.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Create_WithValidArgs_RaisesMenuItemCreatedDomainEvent()
    {
        ErrorOr<MenuItem> result = CreateValidMenuItem();

        result.IsError.Should().BeFalse();
        result.Value.DomainEvents.Should().ContainSingle(e => e is MenuItemCreatedDomainEvent);
    }

    [Fact]
    public void Create_DomainEvent_ContainsCorrectData()
    {
        ErrorOr<MenuItem> result = CreateValidMenuItem();

        MenuItemCreatedDomainEvent evt = result.Value.DomainEvents
            .OfType<MenuItemCreatedDomainEvent>()
            .Single();

        evt.TenantId.Should().Be(_tenantId);
        evt.BranchId.Should().Be(_branchId);
        evt.Name.Should().Be("Grilled Chicken");
        evt.Price.Should().Be(9.99m);
    }

    [Fact]
    public void Create_NormalizesLowercaseCurrency()
    {
        ErrorOr<MenuItem> result = MenuItem.Create(
            _tenantId, _branchId, MenuCategory.Beverages,
            "Cola", "Soft drink", 2.50m, "sar", 10);

        result.IsError.Should().BeFalse();
        result.Value.Currency.Should().Be("SAR");
    }

    [Fact]
    public void Create_ZeroPrice_ReturnsInvalidPriceError()
    {
        ErrorOr<MenuItem> result = CreateValidMenuItem(price: 0m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(RestaurantErrors.InvalidPrice);
    }

    [Fact]
    public void Create_NegativePrice_ReturnsInvalidPriceError()
    {
        ErrorOr<MenuItem> result = CreateValidMenuItem(price: -5m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(RestaurantErrors.InvalidPrice);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [Fact]
    public void Update_WithValidArgs_UpdatesAllFields()
    {
        MenuItem menuItem = CreateValidMenuItem().Value;

        ErrorOr<Success> result = menuItem.Update(
            MenuCategory.Starters, "Soup", "Tomato soup", 5.50m, 3);

        result.IsError.Should().BeFalse();
        menuItem.Category.Should().Be(MenuCategory.Starters);
        menuItem.Name.Should().Be("Soup");
        menuItem.Description.Should().Be("Tomato soup");
        menuItem.Price.Should().Be(5.50m);
        menuItem.SortOrder.Should().Be(3);
    }

    [Fact]
    public void Update_WithValidArgs_UpdatesUpdatedAt()
    {
        MenuItem menuItem = CreateValidMenuItem().Value;
        DateTime before = menuItem.UpdatedAt;

        menuItem.Update(MenuCategory.Sides, "Fries", "Crispy fries", 3.99m, 5);

        menuItem.UpdatedAt.Should().BeOnOrAfter(before);
    }

    [Fact]
    public void Update_ZeroPrice_ReturnsInvalidPriceError()
    {
        MenuItem menuItem = CreateValidMenuItem().Value;

        ErrorOr<Success> result = menuItem.Update(
            MenuCategory.Mains, "Chicken", "Grilled", 0m, 1);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(RestaurantErrors.InvalidPrice);
    }

    [Fact]
    public void Update_NegativePrice_ReturnsInvalidPriceError()
    {
        MenuItem menuItem = CreateValidMenuItem().Value;

        ErrorOr<Success> result = menuItem.Update(
            MenuCategory.Mains, "Chicken", "Grilled", -10m, 1);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(RestaurantErrors.InvalidPrice);
    }

    // ── SetAvailability ───────────────────────────────────────────────────────

    [Fact]
    public void SetAvailability_ToFalse_SetsIsAvailableToFalse()
    {
        MenuItem menuItem = CreateValidMenuItem().Value;
        menuItem.IsAvailable.Should().BeTrue();

        menuItem.SetAvailability(false);

        menuItem.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void SetAvailability_ToTrue_WhenAlreadyFalse_SetsIsAvailableToTrue()
    {
        MenuItem menuItem = CreateValidMenuItem().Value;
        menuItem.SetAvailability(false);

        menuItem.SetAvailability(true);

        menuItem.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void SetAvailability_UpdatesUpdatedAt()
    {
        MenuItem menuItem = CreateValidMenuItem().Value;
        DateTime before = menuItem.UpdatedAt;

        menuItem.SetAvailability(false);

        menuItem.UpdatedAt.Should().BeOnOrAfter(before);
    }
}
