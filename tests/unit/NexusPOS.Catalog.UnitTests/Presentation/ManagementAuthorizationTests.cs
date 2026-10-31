using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using NexusPOS.Catalog.Presentation;

namespace NexusPOS.Catalog.UnitTests.Presentation;

// Management writes must be refused for Cashier/Staff tokens; hiding the buttons is not enough.
public sealed class ManagementAuthorizationTests
{
    [Theory]
    [InlineData(nameof(ProductsController.CreateProduct))]
    [InlineData(nameof(ProductsController.UpdateProduct))]
    [InlineData(nameof(ProductsController.UpdateVariant))]
    [InlineData(nameof(ProductsController.AddVariant))]
    [InlineData(nameof(ProductsController.DeactivateProduct))]
    public void ProductsController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(ProductsController), action).Should().Be("OwnerOrManager");

    [Theory]
    [InlineData(nameof(CategoriesController.CreateCategory))]
    public void CategoriesController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(CategoriesController), action).Should().Be("OwnerOrManager");

    private static string? PolicyOf(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault()?.Policy;
}
