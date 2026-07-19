using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Gaming.Application.Commands.EndSessionById;
using NexusPOS.Gaming.Application.Commands.ExtendSession;
using NexusPOS.Gaming.Application.Commands.CreateStation;
using NexusPOS.Gaming.Application.Commands.StartSession;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Application.Queries.GetStation;
using NexusPOS.Gaming.Application.Queries.ListActiveSessions;
using NexusPOS.Gaming.Application.Queries.ListStations;
using NexusPOS.Gaming.Domain.Enums;

namespace NexusPOS.Gaming.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/gaming")]
[Produces("application/json")]
[Authorize]
public sealed class GamingController(ISender mediator) : ControllerBase
{
    // ── Stations ────────────────────────────────────────────────────────────

    [HttpGet("stations")]
    [ProducesResponseType(typeof(IReadOnlyList<GameStationResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListStations(
        Guid branchId,
        [FromQuery] StationType? stationType = null,
        [FromQuery] StationStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        ListStationsQuery query = new(branchId, stationType, status, page, pageSize);
        ErrorOr<IReadOnlyList<GameStationResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("stations")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateStation(
        Guid branchId,
        [FromBody] CreateGamingStationRequest request,
        CancellationToken cancellationToken)
    {
        CreateStationCommand command = new(
            request.TenantId, branchId, request.StationType, request.Name,
            request.HourlyRate, request.Currency);

        ErrorOr<GameStationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            station => CreatedAtAction(
                nameof(GetStation),
                new { branchId, stationId = station.Id },
                station),
            MapErrorsToResult);
    }

    [HttpGet("stations/{stationId:guid}")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStation(Guid branchId, Guid stationId, CancellationToken cancellationToken)
    {
        GetStationQuery query = new(stationId, branchId);
        ErrorOr<GameStationResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("stations/{stationId:guid}/start")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> StartSession(
        Guid branchId,
        Guid stationId,
        [FromBody] StartSessionRequest request,
        CancellationToken cancellationToken)
    {
        StartSessionCommand command = new(
            stationId, branchId,
            request.PlayerName, request.DurationMinutes, request.RatePerHour);

        ErrorOr<GameStationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    // ── Sessions ────────────────────────────────────────────────────────────

    [HttpGet("sessions/active")]
    [ProducesResponseType(typeof(IReadOnlyList<GameSessionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListActiveSessions(Guid branchId, CancellationToken cancellationToken)
    {
        ListActiveSessionsQuery query = new(branchId);
        ErrorOr<IReadOnlyList<GameSessionResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("sessions/{sessionId:guid}/extend")]
    [ProducesResponseType(typeof(GameStationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ExtendSession(
        Guid branchId,
        Guid sessionId,
        [FromBody] ExtendSessionRequest request,
        CancellationToken cancellationToken)
    {
        ExtendSessionCommand command = new(sessionId, branchId, request.ExtraMinutes);
        ErrorOr<GameStationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("sessions/{sessionId:guid}/end")]
    [ProducesResponseType(typeof(GameSessionBillResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> EndSession(
        Guid branchId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        EndSessionByIdCommand command = new(sessionId, branchId);
        ErrorOr<GameSessionBillResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

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

public sealed record CreateGamingStationRequest(
    Guid TenantId,
    StationType StationType,
    string Name,
    decimal HourlyRate,
    string Currency);

public sealed record StartSessionRequest(
    string PlayerName,
    int DurationMinutes,
    decimal RatePerHour);

public sealed record ExtendSessionRequest(int ExtraMinutes);
