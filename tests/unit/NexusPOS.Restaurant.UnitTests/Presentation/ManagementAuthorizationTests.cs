using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using NexusPOS.Restaurant.Presentation;

namespace NexusPOS.Restaurant.UnitTests.Presentation;

// Management writes must be refused for Cashier/Staff tokens; hiding the buttons is not enough.
public sealed class ManagementAuthorizationTests
{
    [Theory]
    [InlineData(nameof(DiscountCodesController.CreateDiscountCode))]
    public void DiscountCodesController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(DiscountCodesController), action).Should().Be("OwnerOrManager");

    private static string? PolicyOf(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault()?.Policy;
}
