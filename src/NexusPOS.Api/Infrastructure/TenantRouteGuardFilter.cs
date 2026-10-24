using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace NexusPOS.Api.Infrastructure;

// Rejects any request whose {tenantId} route value differs from the caller's tenant_id claim.
internal sealed class TenantRouteGuardFilter(ILogger<TenantRouteGuardFilter> logger) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!context.RouteData.Values.TryGetValue("tenantId", out object? routeValue) || routeValue is null)
        {
            await next();
            return;
        }

        string? claim = context.HttpContext.User.FindFirst("tenant_id")?.Value;
        bool matches = Guid.TryParse(routeValue.ToString(), out Guid routeTenant)
            && Guid.TryParse(claim, out Guid claimTenant)
            && routeTenant == claimTenant;

        if (!matches)
        {
            logger.LogWarning(
                "Cross-tenant access denied: user {UserId} with tenant {ClaimTenant} requested tenant {RouteTenant} at {Path}",
                context.HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
                claim ?? "<none>",
                routeValue,
                context.HttpContext.Request.Path);
            context.Result = new ForbidResult();
            return;
        }

        await next();
    }
}
