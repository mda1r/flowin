using System.Security.Claims;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Api.Infrastructure;

internal sealed class TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext)
    {
        string? tenantClaim = context.User.FindFirstValue("tenant_id");
        string? userClaim = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        string? branchClaim = context.User.FindFirstValue("branch_id");

        if (!string.IsNullOrEmpty(tenantClaim) &&
            Guid.TryParse(tenantClaim, out var tenantId) &&
            tenantContext is MutableTenantContext mutable)
        {
            mutable.TenantId = tenantId;
            mutable.SchemaName = $"tenant_{tenantId:N}";
            mutable.IsAuthenticated = true;

            if (!string.IsNullOrEmpty(userClaim) && Guid.TryParse(userClaim, out var userId))
            {
                mutable.UserId = userId;
            }

            if (!string.IsNullOrEmpty(branchClaim) && Guid.TryParse(branchClaim, out var branchId))
            {
                mutable.BranchId = branchId;
            }

            logger.LogDebug("Tenant context set: schema={Schema}", mutable.SchemaName);
        }

        await next(context);
    }
}

internal sealed class MutableTenantContext : ITenantContext
{
    public Guid? TenantId { get; set; }
    public string SchemaName { get; set; } = "public";
    public Guid? BranchId { get; set; }
    public Guid? UserId { get; set; }
    public bool IsAuthenticated { get; set; }
}

internal static class TenantMiddlewareExtensions
{
    internal static IApplicationBuilder UseTenantContext(this IApplicationBuilder app) =>
        app.UseMiddleware<TenantMiddleware>();
}
