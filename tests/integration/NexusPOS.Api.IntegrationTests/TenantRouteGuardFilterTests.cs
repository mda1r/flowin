using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging.Abstractions;
using NexusPOS.Api.Infrastructure;

namespace NexusPOS.Api.IntegrationTests;

public class TenantRouteGuardFilterTests
{
    private static readonly Guid _tenantA = Guid.NewGuid();
    private static readonly Guid _tenantB = Guid.NewGuid();

    private static async Task<(ActionExecutingContext Ctx, bool NextCalled)> Run(object? routeTenant, string? claimTenant)
    {
        DefaultHttpContext http = new();
        List<Claim> claims = [];
        if (claimTenant is not null)
        {
            claims.Add(new Claim("tenant_id", claimTenant));
        }
        http.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));

        RouteData routeData = new();
        if (routeTenant is not null)
        {
            routeData.Values["tenantId"] = routeTenant;
        }

        ActionContext actionContext = new(http, routeData, new ActionDescriptor());
        ActionExecutingContext ctx = new(actionContext, [], new Dictionary<string, object?>(), new object());

        bool nextCalled = false;
        TenantRouteGuardFilter filter = new(NullLogger<TenantRouteGuardFilter>.Instance);
        await filter.OnActionExecutionAsync(ctx, () =>
        {
            nextCalled = true;
            return Task.FromResult(new ActionExecutedContext(actionContext, [], new object()));
        });
        return (ctx, nextCalled);
    }

    [Fact]
    public async Task Allows_matching_tenant()
    {
        (ActionExecutingContext ctx, bool next) = await Run(_tenantA.ToString(), _tenantA.ToString());
        next.Should().BeTrue();
        ctx.Result.Should().BeNull();
    }

    [Fact]
    public async Task Forbids_other_tenant()
    {
        (ActionExecutingContext ctx, bool next) = await Run(_tenantB.ToString(), _tenantA.ToString());
        next.Should().BeFalse();
        ctx.Result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task Forbids_caller_without_tenant_claim()
    {
        (ActionExecutingContext ctx, bool next) = await Run(_tenantA.ToString(), null);
        next.Should().BeFalse();
        ctx.Result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task Ignores_routes_without_tenantId()
    {
        (ActionExecutingContext ctx, bool next) = await Run(null, null);
        next.Should().BeTrue();
        ctx.Result.Should().BeNull();
    }
}
