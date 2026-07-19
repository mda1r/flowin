using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Gaming.Application.Commands.CreateStation;
using NexusPOS.Gaming.Application.Commands.EndSession;
using NexusPOS.Gaming.Application.Commands.SetMaintenance;
using NexusPOS.Gaming.Application.Commands.StartSession;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Application.Queries.GetStation;
using NexusPOS.Gaming.Application.Queries.ListStations;
using NexusPOS.Gaming.Domain.Enums;

namespace NexusPOS.Gaming.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/game-stations")]
[Produces("application/json")]
[Authorize]
public sealed class GameStationsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<GameStationResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListStations(
        Guid branchId,
        [FromQuery] StationType? stationType = null,
        [FromQuery] StationStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListStationsQuery query = new(branchId, stationType, status, page, pageSize);
        ErrorOr<IReadOnlyList<GameStationResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{stationId:guid}")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStation(Guid branchId, Guid stationId, CancellationToken cancellationToken)
    {
        GetStationQuery query = new(stationId, branchId);
        ErrorOr<GameStationResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateStation(
        Guid branchId,
        [FromBody] CreateStationRequest request,
        CancellationToken cancellationToken)
    {
        CreateStationCommand command = new(
            request.TenantId, branchId, request.StationType, request.Name,
            request.HourlyRate, request.Currency);
        ErrorOr<GameStationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            station => CreatedAtAction(nameof(GetStation), new { branchId, stationId = station.Id }, station),
            MapErrorsToResult);
    }

    [HttpPost("{stationId:guid}/start")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> StartSession(
        Guid branchId,
        Guid stationId,
        [FromBody] StartSessionBody body,
        CancellationToken cancellationToken)
    {
        StartSessionCommand command = new(stationId, branchId, body.PlayerName, body.DurationMinutes, body.RatePerHour);
        ErrorOr<GameStationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{stationId:guid}/end")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> EndSession(Guid branchId, Guid stationId, CancellationToken cancellationToken)
    {
        EndSessionCommand command = new(stationId, branchId);
        ErrorOr<GameStationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{stationId:guid}/maintenance")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetMaintenance(Guid branchId, Guid stationId, CancellationToken cancellationToken)
    {
        SetMaintenanceCommand command = new(stationId, branchId);
        ErrorOr<GameStationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors)
    {
        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError,
        };
        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}

public sealed record CreateStationRequest(
    Guid TenantId,
    StationType StationType,
    string Name,
    decimal HourlyRate,
    string Currency);

public sealed record StartSessionBody(
    string PlayerName,
    int DurationMinutes,
    decimal RatePerHour);
