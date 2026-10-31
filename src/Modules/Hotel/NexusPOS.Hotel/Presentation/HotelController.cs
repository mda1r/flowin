using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Hotel.Application.Commands.CheckIn;
using NexusPOS.Hotel.Application.Commands.CheckOut;
using NexusPOS.Hotel.Application.Commands.CreateRoom;
using NexusPOS.Hotel.Application.Commands.MarkRoomClean;
using NexusPOS.Hotel.Application.Commands.MarkRoomNeedsClean;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Application.Queries.GetCheckoutAlerts;
using NexusPOS.Hotel.Application.Queries.ListHotelRooms;
using NexusPOS.Hotel.Application.Queries.ListReservations;
using NexusPOS.Hotel.Domain.Enums;

namespace NexusPOS.Hotel.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/hotel")]
[Produces("application/json")]
[Authorize]
public sealed class HotelController(ISender mediator) : ControllerBase
{
    // ── Rooms ─────────────────────────────────────────────────────────────────

    [HttpGet("rooms")]
    [ProducesResponseType(typeof(IReadOnlyList<RoomResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRooms(
        Guid branchId,
        CancellationToken cancellationToken)
    {
        ListHotelRoomsQuery query = new(branchId);
        ErrorOr<IReadOnlyList<RoomResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("rooms")]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateRoom(
        Guid branchId,
        [FromBody] CreateHotelRoomRequest request,
        CancellationToken cancellationToken)
    {
        CreateRoomCommand command = new(
            request.TenantId, branchId, request.RoomType, request.RoomNumber,
            request.Floor, request.Capacity, request.NightlyRate, request.Currency,
            request.Description);

        ErrorOr<RoomResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            room => CreatedAtAction(nameof(ListRooms), new { branchId }, room),
            MapErrorsToResult);
    }

    [HttpPost("rooms/{roomId:guid}/checkin")]
    [ProducesResponseType(typeof(ReservationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CheckIn(
        Guid branchId,
        Guid roomId,
        [FromBody] CheckInRequest request,
        CancellationToken cancellationToken)
    {
        CheckInCommand command = new(
            request.TenantId, branchId, roomId,
            request.GuestName, request.GuestNationalId, request.GuestPhone,
            request.CheckIn, request.CheckOut, request.RatePerNight, request.Notes);

        ErrorOr<ReservationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("rooms/{roomId:guid}/mark-clean")]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkClean(
        Guid branchId,
        Guid roomId,
        CancellationToken cancellationToken)
    {
        MarkRoomCleanCommand command = new(roomId, branchId);
        ErrorOr<RoomResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("rooms/{roomId:guid}/mark-needs-clean")]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkNeedsClean(
        Guid branchId,
        Guid roomId,
        CancellationToken cancellationToken)
    {
        MarkRoomNeedsCleanCommand command = new(roomId, branchId);
        ErrorOr<RoomResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    // ── Reservations ──────────────────────────────────────────────────────────

    [HttpGet("reservations")]
    [ProducesResponseType(typeof(IReadOnlyList<ReservationResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListReservations(
        Guid branchId,
        CancellationToken cancellationToken)
    {
        ListReservationsQuery query = new(branchId);
        ErrorOr<IReadOnlyList<ReservationResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("reservations/alerts")]
    [ProducesResponseType(typeof(IReadOnlyList<ReservationResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCheckoutAlerts(
        Guid branchId,
        CancellationToken cancellationToken)
    {
        GetCheckoutAlertsQuery query = new(branchId);
        ErrorOr<IReadOnlyList<ReservationResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("reservations/{reservationId:guid}/checkout")]
    [ProducesResponseType(typeof(ReservationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CheckOut(
        Guid branchId,
        Guid reservationId,
        CancellationToken cancellationToken)
    {
        CheckOutCommand command = new(reservationId, branchId);
        ErrorOr<ReservationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    // ── Error mapping ─────────────────────────────────────────────────────────

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

// ── Request DTOs ─────────────────────────────────────────────────────────────

public sealed record CreateHotelRoomRequest(
    Guid TenantId,
    RoomType RoomType,
    string RoomNumber,
    int Floor,
    int Capacity,
    decimal NightlyRate,
    string Currency,
    string? Description = null);

public sealed record CheckInRequest(
    Guid TenantId,
    string GuestName,
    string GuestNationalId,
    string GuestPhone,
    DateTime CheckIn,
    DateTime CheckOut,
    decimal RatePerNight,
    string? Notes = null);
