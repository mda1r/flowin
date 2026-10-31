using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
using NexusPOS.Organization.Presentation;

namespace NexusPOS.Organization.UnitTests.Presentation;

// Management writes must be refused for Cashier/Staff tokens; hiding the buttons is not enough.
public sealed class ManagementAuthorizationTests
{
    [Theory]
    [InlineData(nameof(BranchesController.CreateBranch))]
    [InlineData(nameof(BranchesController.UpdateBranch))]
    [InlineData(nameof(BranchesController.DeactivateBranch))]
    public void BranchesController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(BranchesController), action).Should().Be("OwnerOrManager");

    [Theory]
    [InlineData(nameof(TenantsController.UpdateProfile))]
    public void TenantsController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(TenantsController), action).Should().Be("OwnerOrManager");

    [Theory]
    [InlineData(nameof(TenantsController.GetTenant))]
    [InlineData(nameof(TenantsController.UpdateProfile))]
    public void TenantsController_RoutesUseTenantIdSoTheRouteGuardApplies(string action)
    {
        MethodInfo method = typeof(TenantsController).GetMethod(action)!;
        string template = method.GetCustomAttributes<HttpMethodAttribute>().Single().Template!;

        template.Should().StartWith("{tenantId:guid}");
    }

    private static string? PolicyOf(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault()?.Policy;
}
