using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.POS.Application.Settings;

namespace NexusPOS.POS.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/pos-settings")]
[Produces("application/json")]
[Authorize]
public sealed class PosSettingsController(ISender mediator) : ControllerBase
{
    /// <summary>The branch till rules: the cashier discount cap and whether a manager PIN is set.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PosBranchSettingsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid branchId, CancellationToken cancellationToken)
    {
        ErrorOr<PosBranchSettingsResponse> result = await mediator.Send(new GetPosBranchSettingsQuery(branchId), cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Set the cashier discount cap and the manager approval PIN.</summary>
    [HttpPut]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(PosBranchSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Save(Guid branchId, [FromBody] SavePosBranchSettingsRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirst("tenant_id")?.Value, out Guid tenantId))
        {
            return Forbid();
        }

        SavePosBranchSettingsCommand command = new(
            tenantId, branchId, request.MaxCashierDiscountPercent, request.ApprovalPin, request.ClearApprovalPin);
        ErrorOr<PosBranchSettingsResponse> result = await mediator.Send(command, cancellationToken);
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
        return Problem(title: first.Code, detail: first.Description, statusCode: StatusCodes.Status500InternalServerError);
    }
}

public sealed record SavePosBranchSettingsRequest(decimal MaxCashierDiscountPercent, string? ApprovalPin, bool ClearApprovalPin = false);
