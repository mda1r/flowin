using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Organization.Application.Commands.CreateTenant;
using NexusPOS.Organization.Application.Commands.UpdateTenantProfile;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Application.Queries.GetTenantById;
using NexusPOS.Organization.Presentation.Requests;

namespace NexusPOS.Organization.Presentation;

[ApiController]
[Route("api/v1/tenants")]
[Produces("application/json")]
[Authorize]
public sealed class TenantsController(ISender mediator) : ControllerBase
{
    /// <summary>Create a new tenant (system-level operation).</summary>
    [HttpPost]
    [AllowAnonymous]
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
            tenant => CreatedAtAction(nameof(GetTenant), new { id = tenant.Id }, tenant),
            MapErrorsToResult);
    }

    /// <summary>Get a tenant by ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTenant(
        Guid id,
        CancellationToken cancellationToken)
    {
        GetTenantByIdQuery query = new(id);
        ErrorOr<TenantResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Update a tenant's profile information.</summary>
    [HttpPut("{id:guid}/profile")]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateProfile(
        Guid id,
        [FromBody] UpdateTenantProfileRequest request,
        CancellationToken cancellationToken)
    {
        UpdateTenantProfileCommand command = new(
            id,
            request.Name,
            request.Currency,
            request.TimeZone,
            request.LogoUrl,
            request.PhoneNumber,
            request.TaxId);

        ErrorOr<TenantResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors)
    {
        if (errors.TrueForAll(e => e.Type == ErrorType.Validation))
        {
            ValidationProblemDetails problemDetails = new();
            foreach (Error error in errors)
            {
                problemDetails.Errors[error.Code] = [error.Description];
            }

            return ValidationProblem(problemDetails);
        }

        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}
