using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using NexusPOS.Purchasing.Presentation;

namespace NexusPOS.Purchasing.UnitTests.Presentation;

// Management writes must be refused for Cashier/Staff tokens; hiding the buttons is not enough.
public sealed class ManagementAuthorizationTests
{
    [Theory]
    [InlineData(nameof(SuppliersController.CreateSupplier))]
    [InlineData(nameof(SuppliersController.UpdateSupplier))]
    [InlineData(nameof(SuppliersController.DeactivateSupplier))]
    public void SuppliersController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(SuppliersController), action).Should().Be("OwnerOrManager");

    private static string? PolicyOf(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault()?.Policy;
}
