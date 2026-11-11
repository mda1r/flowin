using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Organization.Application.Commands.CreateTenant;
using NexusPOS.Organization.Application.Commands.SetTenantVat;
using NexusPOS.Organization.Application.Commands.UpdateTenantProfile;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Application.Queries.GetTenantById;
using NexusPOS.Organization.Presentation.Requests;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Organization.Presentation;

[ApiController]
[Route("api/v1/tenants")]
[Produces("application/json")]
[Authorize]
public sealed class TenantsController(ISender mediator) : ControllerBase
{
    /// <summary>Create a new tenant (system-level operation). Shops sign up through /api/v1/auth/register.</summary>
    [HttpPost]
    [Authorize(Policy = "SuperAdmin")]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateTenant(
        [FromBody] CreateTenantRequest request,
        CancellationToken cancellationToken)
    {
        CreateTenantCommand command = new(
            request.Name,
            request.Subdomain,
            request.AdminEmail,
            request.Currency,
            request.TimeZone);

        ErrorOr<TenantResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            tenant => CreatedAtAction(nameof(GetTenant), new { tenantId = tenant.Id }, tenant),
            MapErrorsToResult);
    }

    /// <summary>Get a tenant by ID. The {tenantId} route value is checked against the caller's tenant claim.</summary>
    [HttpGet("{tenantId:guid}")]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTenant(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        GetTenantByIdQuery query = new(tenantId);
        ErrorOr<TenantResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Update a tenant's profile information.</summary>
    [HttpPut("{tenantId:guid}/profile")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateProfile(
        Guid tenantId,
        [FromBody] UpdateTenantProfileRequest request,
        CancellationToken cancellationToken)
    {
        UpdateTenantProfileCommand command = new(
            tenantId,
            request.Name,
            request.Currency,
            request.TimeZone,
            request.LogoUrl,
            request.PhoneNumber,
            request.TaxId);

        ErrorOr<TenantResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Switch VAT on or off for the shop. Off: sales, invoices and reports carry no VAT at all.
    /// The {tenantId} route value is checked against the caller's tenant claim.</summary>
    [HttpPut("{tenantId:guid}/vat")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(TenantVatResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetVat(Guid tenantId, [FromBody] SetTenantVatRequest request, CancellationToken cancellationToken)
    {
        ErrorOr<TenantVatResponse> result = await mediator.Send(new SetTenantVatCommand(tenantId, request.Enabled), cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}

public sealed record SetTenantVatRequest(bool Enabled);
