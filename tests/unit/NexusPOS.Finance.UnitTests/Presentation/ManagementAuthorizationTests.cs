using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using NexusPOS.Finance.Presentation;

namespace NexusPOS.Finance.UnitTests.Presentation;

// Management writes must be refused for Cashier/Staff tokens; hiding the buttons is not enough.
public sealed class ManagementAuthorizationTests
{
    [Theory]
    [InlineData(nameof(ExpensesController.ApproveExpense))]
    [InlineData(nameof(ExpensesController.VoidExpense))]
    public void ExpensesController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(ExpensesController), action).Should().Be("OwnerManagerOrAccountant");

    private static string? PolicyOf(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault()?.Policy;
}
