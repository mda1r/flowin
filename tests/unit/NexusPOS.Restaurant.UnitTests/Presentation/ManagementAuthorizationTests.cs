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
    [InlineData(nameof(DiscountCodesController.UpdateDiscountCode))]
    [InlineData(nameof(DiscountCodesController.DeleteDiscountCode))]
    [InlineData(nameof(DiscountCodesController.ListDiscountCodes))]
    public void DiscountCodesController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(DiscountCodesController), action).Should().Be("OwnerOrManager");

    // The till checks a code for any signed-in user of the store; the class-level [Authorize] still needs a sign-in.
    [Fact]
    public void DiscountCodesController_Validate_IsOpenToTheTill() =>
        PolicyOf(typeof(DiscountCodesController), nameof(DiscountCodesController.ValidateDiscountCode)).Should().BeNull();

    private static string? PolicyOf(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault()?.Policy;
}
