using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Hotel.Application.Commands.CancelReservation;
using NexusPOS.Hotel.Application.Commands.CheckIn;
using NexusPOS.Hotel.Application.Commands.CheckOut;
using NexusPOS.Hotel.Application.Commands.CreateRoom;
using NexusPOS.Hotel.Application.Commands.ExtendReservation;
using NexusPOS.Hotel.Application.Commands.MarkRoomClean;
using NexusPOS.Hotel.Application.Commands.MarkRoomNeedsClean;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Application.Queries.GetCheckoutAlerts;
using NexusPOS.Hotel.Application.Queries.ListHotelRooms;
using NexusPOS.Hotel.Application.Queries.ListReservations;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.SharedKernel.Presentation;

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
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateRoom(
        Guid branchId,
        [FromBody] CreateHotelRoomRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out Guid tenantId))
        {
            return Forbid();
        }

        CreateRoomCommand command = new(
            tenantId, branchId, request.RoomType, request.RoomNumber,
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
        if (!TryGetTenantId(out Guid tenantId))
        {
            return Forbid();
        }

        CheckInCommand command = new(
            tenantId, branchId, roomId,
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

    [HttpPost("reservations/{reservationId:guid}/cancel")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(ReservationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelReservation(
        Guid branchId,
        Guid reservationId,
        CancellationToken cancellationToken)
    {
        CancelReservationCommand command = new(reservationId, branchId);
        ErrorOr<ReservationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPatch("reservations/{reservationId:guid}/extend")]
    [ProducesResponseType(typeof(ReservationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ExtendReservation(
        Guid branchId,
        Guid reservationId,
        [FromBody] ExtendReservationRequest request,
        CancellationToken cancellationToken)
    {
        ExtendReservationCommand command = new(reservationId, branchId, request.CheckOut);
        ErrorOr<ReservationResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    // The tenant always comes from the caller's token, never from the request body.
    private bool TryGetTenantId(out Guid tenantId) =>
        Guid.TryParse(User.FindFirst("tenant_id")?.Value, out tenantId) && tenantId != Guid.Empty;

    // ── Error mapping ─────────────────────────────────────────────────────────

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public sealed record CreateHotelRoomRequest(
    RoomType RoomType,
    string RoomNumber,
    int Floor,
    int Capacity,
    decimal NightlyRate,
    string Currency,
    string? Description = null);

public sealed record CheckInRequest(
    string GuestName,
    string GuestNationalId,
    string GuestPhone,
    DateTime CheckIn,
    DateTime CheckOut,
    decimal RatePerNight,
    string? Notes = null);

public sealed record ExtendReservationRequest(DateTime CheckOut);
