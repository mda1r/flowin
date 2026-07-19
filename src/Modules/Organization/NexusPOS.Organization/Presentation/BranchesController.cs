using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Organization.Application.Commands.CreateBranch;
using NexusPOS.Organization.Application.Commands.DeactivateBranch;
using NexusPOS.Organization.Application.Commands.UpdateBranch;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Application.Queries.GetBranchById;
using NexusPOS.Organization.Application.Queries.ListBranches;
using NexusPOS.Organization.Presentation.Requests;

namespace NexusPOS.Organization.Presentation;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/branches")]
[Produces("application/json")]
[Authorize]
public sealed class BranchesController(ISender mediator) : ControllerBase
{
    /// <summary>List all branches for a tenant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<BranchResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListBranches(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        ListBranchesQuery query = new(tenantId);
        ErrorOr<IReadOnlyList<BranchResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get a specific branch by ID.</summary>
    [HttpGet("{branchId:guid}")]
    [ProducesResponseType(typeof(BranchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBranch(
        Guid tenantId,
        Guid branchId,
        CancellationToken cancellationToken)
    {
        GetBranchByIdQuery query = new(branchId, tenantId);
        ErrorOr<BranchResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Create a new branch for a tenant.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(BranchResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateBranch(
        Guid tenantId,
        [FromBody] CreateBranchRequest request,
        CancellationToken cancellationToken)
    {
        CreateBranchCommand command = new(
            tenantId,
            request.Name,
            request.Type,
            request.IsMainBranch,
            request.PhoneNumber,
            request.Email,
            request.Street,
            request.City,
            request.State,
            request.Country,
            request.PostalCode);

        ErrorOr<BranchResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            branch => CreatedAtAction(nameof(GetBranch), new { tenantId, branchId = branch.Id }, branch),
            MapErrorsToResult);
    }

    /// <summary>Update an existing branch.</summary>
    [HttpPut("{branchId:guid}")]
    [ProducesResponseType(typeof(BranchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateBranch(
        Guid tenantId,
        Guid branchId,
        [FromBody] UpdateBranchRequest request,
        CancellationToken cancellationToken)
    {
        UpdateBranchCommand command = new(
            branchId,
            tenantId,
            request.Name,
            request.Type,
            request.PhoneNumber,
            request.Email,
            request.Street,
            request.City,
            request.State,
            request.Country,
            request.PostalCode);

        ErrorOr<BranchResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Deactivate a branch.</summary>
    [HttpDelete("{branchId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateBranch(
        Guid tenantId,
        Guid branchId,
        CancellationToken cancellationToken)
    {
        DeactivateBranchCommand command = new(branchId, tenantId);
        ErrorOr<Success> result = await mediator.Send(command, cancellationToken);

        return result.Match(_ => NoContent(), MapErrorsToResult);
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
