using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.SuperAdmin.Application.Commands.ActivateTenant;
using NexusPOS.SuperAdmin.Application.Commands.CreateSubscription;
using NexusPOS.SuperAdmin.Application.Commands.CreateSubscriptionPlan;
using NexusPOS.SuperAdmin.Application.Commands.CreateTenant;
using NexusPOS.SuperAdmin.Application.Commands.DeleteTenant;
using NexusPOS.SuperAdmin.Application.Commands.SuspendTenant;
using NexusPOS.SuperAdmin.Application.Commands.UpdatePlanFeatures;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Application.Queries.GetTenant;
using NexusPOS.SuperAdmin.Application.Queries.ListSubscriptionPlans;
using NexusPOS.SuperAdmin.Application.Queries.ListTenants;
using NexusPOS.SuperAdmin.Presentation.Requests;

namespace NexusPOS.SuperAdmin.Presentation;

[ApiController]
[Route("api/v1/superadmin")]
[Produces("application/json")]
[Authorize(Policy = "SuperAdmin")]
public sealed class SuperAdminController(ISender mediator) : ControllerBase
{
    /// <summary>إنشاء مستأجر جديد</summary>
    [HttpPost("tenants")]
    [ProducesResponseType(typeof(TenantWithSubscriptionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateTenant(
        [FromBody] CreateTenantRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateTenantCommand(
            request.Name,
            request.Subdomain,
            request.AdminEmail,
            request.BusinessType,
            request.Currency,
            request.TimeZone);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            tenant => CreatedAtAction(nameof(GetTenant), new { id = tenant.Id }, tenant),
            MapErrors);
    }

    /// <summary>قائمة جميع المستأجرين مع حالة اشتراكاتهم</summary>
    [HttpGet("tenants")]
    [ProducesResponseType(typeof(List<TenantWithSubscriptionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTenants(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ListTenantsQuery(), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>تفاصيل مستأجر محدد مع تاريخ الاشتراكات</summary>
    [HttpGet("tenants/{id:guid}")]
    [ProducesResponseType(typeof(TenantDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTenant(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetTenantQuery(id), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إنشاء اشتراك جديد للمستأجر</summary>
    [HttpPost("tenants/{id:guid}/subscriptions")]
    [ProducesResponseType(typeof(TenantSubscriptionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateSubscription(
        Guid id,
        [FromBody] CreateSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateSubscriptionCommand(id, request.PlanId, request.StartDate, request.ExpiryDate, request.Notes);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            sub => CreatedAtAction(nameof(GetTenant), new { id }, sub),
            MapErrors);
    }

    /// <summary>تعليق حساب المستأجر</summary>
    [HttpPost("tenants/{id:guid}/suspend")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SuspendTenant(
        Guid id,
        [FromBody] SuspendTenantRequest request,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SuspendTenantCommand(id, request.Reason), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    /// <summary>حذف مستأجر نهائياً</summary>
    [HttpDelete("tenants/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTenant(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new DeleteTenantCommand(id), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    /// <summary>تفعيل حساب المستأجر</summary>
    [HttpPost("tenants/{id:guid}/activate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ActivateTenant(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ActivateTenantCommand(id), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    /// <summary>قائمة خطط الاشتراك</summary>
    [HttpGet("plans")]
    [ProducesResponseType(typeof(List<SubscriptionPlanResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPlans(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ListSubscriptionPlansQuery(), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إنشاء خطة اشتراك جديدة</summary>
    [HttpPost("plans")]
    [ProducesResponseType(typeof(SubscriptionPlanResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreatePlan(
        [FromBody] CreateSubscriptionPlanRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateSubscriptionPlanCommand(
            request.Name,
            request.BusinessType,
            request.Price,
            request.MaxBranches,
            request.MaxUsers,
            request.Features);

        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            plan => CreatedAtAction(nameof(ListPlans), plan),
            MapErrors);
    }

    /// <summary>تحديث ميزات خطة الاشتراك</summary>
    [HttpPut("plans/{planId:guid}/features")]
    [ProducesResponseType(typeof(SubscriptionPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePlanFeatures(
        Guid planId,
        [FromBody] UpdatePlanFeaturesRequest request,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new UpdatePlanFeaturesCommand(planId, request.Features), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    private IActionResult MapErrors(List<Error> errors)
    {
        if (errors.TrueForAll(e => e.Type == ErrorType.Validation))
        {
            ValidationProblemDetails pd = new();
            foreach (Error error in errors)
            {
                pd.Errors[error.Code] = [error.Description];
            }

            return ValidationProblem(pd);
        }

        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}
