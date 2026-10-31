using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.CRM.Application.Commands.UpdateLoyaltySettings;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Application.Queries.GetLoyaltySettings;

namespace NexusPOS.CRM.Presentation;

// Every till reads the programme to show what points are worth; only owners and managers may change it.
[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/loyalty-settings")]
[Produces("application/json")]
[Authorize]
public sealed class LoyaltySettingsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(LoyaltySettingsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid tenantId, CancellationToken cancellationToken)
    {
        ErrorOr<LoyaltySettingsResponse> result = await mediator.Send(new GetLoyaltySettingsQuery(tenantId), cancellationToken);
        return result.Match(Ok, Problem);
    }

    [HttpPut]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(LoyaltySettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Update(
        Guid tenantId, [FromBody] UpdateLoyaltySettingsRequest request, CancellationToken cancellationToken)
    {
        UpdateLoyaltySettingsCommand command = new(
            tenantId, request.Enabled, request.PointsPerCurrencyUnit, request.RedeemPoints, request.RedeemValue, request.MinRedeemPoints);
        ErrorOr<LoyaltySettingsResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, Problem);
    }

    private IActionResult Problem(List<Error> errors)
    {
        Error first = errors[0];
        int statusCode = first.Type == ErrorType.Validation
            ? StatusCodes.Status422UnprocessableEntity
            : StatusCodes.Status500InternalServerError;
        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}

public sealed record UpdateLoyaltySettingsRequest(
    bool Enabled,
    decimal PointsPerCurrencyUnit,
    int RedeemPoints,
    decimal RedeemValue,
    int MinRedeemPoints);
