using System.Security.Claims;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.SuperAdmin.Application.Commands.ActivateTenant;
using NexusPOS.SuperAdmin.Application.Commands.CreateBrand;
using NexusPOS.SuperAdmin.Application.Commands.CreateSubscription;
using NexusPOS.SuperAdmin.Application.Commands.CreateSubscriptionPlan;
using NexusPOS.SuperAdmin.Application.Commands.CreateTenant;
using NexusPOS.SuperAdmin.Application.Commands.CreateTenantAndLinkToBrand;
using NexusPOS.SuperAdmin.Application.Commands.DeleteTenant;
using NexusPOS.SuperAdmin.Application.Commands.LinkTenantToBrand;
using NexusPOS.SuperAdmin.Application.Commands.MoveTenantBetweenBrands;
using NexusPOS.SuperAdmin.Application.Commands.SuspendTenant;
using NexusPOS.SuperAdmin.Application.Commands.UnlinkTenantFromBrand;
using NexusPOS.SuperAdmin.Application.Commands.UpdateBrand;
using NexusPOS.SuperAdmin.Application.Commands.UpdatePlanFeatures;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Application.Queries.GetBrandDetail;
using NexusPOS.SuperAdmin.Application.Queries.GetTenant;
using NexusPOS.SuperAdmin.Application.Queries.ListBrands;
using NexusPOS.SuperAdmin.Application.Queries.ListSubscriptionPlans;
using NexusPOS.SuperAdmin.Application.Queries.ListTenants;
using NexusPOS.SuperAdmin.Presentation.Requests;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Application.Queries.ListBranches;
using NexusPOS.SuperAdmin.Application.Commands.SetTenantAiAccess;
using NexusPOS.Tax.Application.Commands.AddTenantToTaxScope;
using NexusPOS.Tax.Application.Commands.CreateTaxScope;
using NexusPOS.Tax.Application.Commands.RemoveTenantFromTaxScope;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Application.Queries.GetTaxScopesByBrand;

namespace NexusPOS.SuperAdmin.Presentation;

[ApiController]
[Route("api/v1/superadmin")]
[Produces("application/json")]
[Authorize(Policy = "SuperAdmin")]
public sealed class SuperAdminController(ISender mediator) : ControllerBase
{
    private Guid ActorId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out Guid id)
            ? id
            : Guid.Empty;

    // ──────────────────────── Tenants ────────────────────────────────────────

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

    /// <summary>تفعيل / إيقاف الذكاء الاصطناعي لمستأجر</summary>
    [HttpPut("tenants/{id:guid}/ai")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetTenantAiAccess(
        Guid id,
        [FromBody] SetTenantAiAccessRequest request,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SetTenantAiAccessCommand(id, request.Enabled), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    /// <summary>قائمة فروع مستأجر محدد</summary>
    [HttpGet("tenants/{id:guid}/branches")]
    [ProducesResponseType(typeof(List<BranchResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTenantBranches(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ListBranchesQuery(id), cancellationToken);
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

    // ──────────────────────── Plans ──────────────────────────────────────────

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

    // ──────────────────────── Brands ─────────────────────────────────────────

    /// <summary>قائمة البراندات</summary>
    [HttpGet("brands")]
    [ProducesResponseType(typeof(ListBrandsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListBrands(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new ListBrandsQuery(status, search, page, pageSize), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إنشاء براند جديد</summary>
    [HttpPost("brands")]
    [ProducesResponseType(typeof(BrandResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateBrand(
        [FromBody] CreateBrandRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateBrandCommand(request.NameAr, request.NameEn, request.Code, request.Notes, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            brand => CreatedAtAction(nameof(GetBrand), new { id = brand.Id }, brand),
            MapErrors);
    }

    /// <summary>تفاصيل براند محدد</summary>
    [HttpGet("brands/{id:guid}")]
    [ProducesResponseType(typeof(BrandDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBrand(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetBrandDetailQuery(id), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>تحديث براند</summary>
    [HttpPut("brands/{id:guid}")]
    [ProducesResponseType(typeof(BrandResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateBrand(
        Guid id,
        [FromBody] UpdateBrandRequest request,
        CancellationToken cancellationToken)
    {
        var command = new UpdateBrandCommand(id, request.NameAr, request.NameEn, request.Notes, request.Status, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>ربط مستأجر ببراند</summary>
    [HttpPost("brands/{id:guid}/members")]
    [ProducesResponseType(typeof(BrandMemberResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> LinkTenantToBrand(
        Guid id,
        [FromBody] LinkTenantToBrandRequest request,
        CancellationToken cancellationToken)
    {
        var command = new LinkTenantToBrandCommand(
            id, request.TenantId, request.BranchDisplayName, request.BranchCode, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            member => CreatedAtAction(nameof(GetBrand), new { id }, member),
            MapErrors);
    }

    /// <summary>فصل عضوية مستأجر من براند</summary>
    [HttpDelete("brands/members/{membershipId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnlinkTenantFromBrand(
        Guid membershipId,
        CancellationToken cancellationToken)
    {
        var command = new UnlinkTenantFromBrandCommand(membershipId, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    /// <summary>نقل مستأجر بين براندات</summary>
    [HttpPost("brands/{id:guid}/move-tenant")]
    [ProducesResponseType(typeof(BrandMemberResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> MoveTenantToBrand(
        Guid id,
        [FromBody] MoveTenantBetweenBrandsRequest request,
        CancellationToken cancellationToken)
    {
        var command = new MoveTenantBetweenBrandsCommand(
            request.TenantId, id, request.NewBranchDisplayName, request.NewBranchCode, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إنشاء مستأجر وربطه ببراند في خطوة واحدة</summary>
    [HttpPost("brands/{id:guid}/tenants")]
    [ProducesResponseType(typeof(BrandMemberResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateTenantUnderBrand(
        Guid id,
        [FromBody] CreateTenantUnderBrandRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateTenantAndLinkToBrandCommand(
            id,
            request.Name,
            request.Subdomain,
            request.AdminEmail,
            request.BusinessType,
            request.Currency,
            request.TimeZone,
            request.BranchDisplayName,
            request.BranchCode,
            ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            member => CreatedAtAction(nameof(GetBrand), new { id }, member),
            MapErrors);
    }

    // ──────────────────────── Tax Scopes ─────────────────────────────────────

    /// <summary>قائمة نطاقات الضريبة للبراند</summary>
    [HttpGet("brands/{id:guid}/tax-scopes")]
    [ProducesResponseType(typeof(List<TaxScopeResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBrandTaxScopes(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetTaxScopesByBrandQuery(id), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إنشاء نطاق ضريبي للبراند</summary>
    [HttpPost("brands/{id:guid}/tax-scopes")]
    [ProducesResponseType(typeof(TaxScopeResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateTaxScope(
        Guid id,
        [FromBody] CreateTaxScopeRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateTaxScopeCommand(id, request.Name, request.VatRegistrationNumber, request.LegalEntityName, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            scope => CreatedAtAction(nameof(GetBrandTaxScopes), new { id }, scope),
            MapErrors);
    }

    /// <summary>إضافة مستأجر لنطاق ضريبي</summary>
    [HttpPost("tax-scopes/{scopeId:guid}/members")]
    [ProducesResponseType(typeof(TaxScopeMemberResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddTenantToTaxScope(
        Guid scopeId,
        [FromBody] AddTenantToTaxScopeRequest request,
        CancellationToken cancellationToken)
    {
        var command = new AddTenantToTaxScopeCommand(scopeId, request.TenantId, request.EffectiveFrom, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(
            member => StatusCode(StatusCodes.Status201Created, member),
            MapErrors);
    }

    /// <summary>إزالة مستأجر من نطاق ضريبي</summary>
    [HttpDelete("tax-scopes/members/{membershipId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveTenantFromTaxScope(
        Guid membershipId,
        [FromQuery] string? reason,
        CancellationToken cancellationToken)
    {
        var command = new RemoveTenantFromTaxScopeCommand(membershipId, reason, ActorId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    // ──────────────────────── Error Mapping ──────────────────────────────────

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
