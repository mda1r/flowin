using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Hotel.Application.Commands.CreateRoom;
using NexusPOS.Hotel.Application.Commands.DeactivateRoom;
using NexusPOS.Hotel.Application.Commands.UpdateRoomStatus;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Application.Queries.GetRoom;
using NexusPOS.Hotel.Application.Queries.ListRooms;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.SharedKernel.Application;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Hotel.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/rooms")]
[Produces("application/json")]
[Authorize]
public sealed class RoomsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RoomResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRooms(
        Guid branchId,
        [FromQuery] RoomType? roomType = null,
        [FromQuery] RoomStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListRoomsQuery query = new(branchId, roomType, status, Paging.Page(page), Paging.Size(pageSize, 500));
        ErrorOr<IReadOnlyList<RoomResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{roomId:guid}")]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRoom(Guid branchId, Guid roomId, CancellationToken cancellationToken)
    {
        GetRoomQuery query = new(roomId, branchId);
        ErrorOr<RoomResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateRoom(
        Guid branchId,
        [FromBody] CreateRoomRequest request,
        CancellationToken cancellationToken)
    {
        CreateRoomCommand command = new(
            request.TenantId, branchId, request.RoomType, request.RoomNumber,
            request.Floor, request.Capacity, request.NightlyRate, request.Currency,
            request.Description);
        ErrorOr<RoomResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            room => CreatedAtAction(nameof(GetRoom), new { branchId, roomId = room.Id }, room),
            MapErrorsToResult);
    }

    [HttpPatch("{roomId:guid}/status")]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateRoomStatus(
        Guid branchId,
        Guid roomId,
        [FromBody] UpdateRoomStatusRequest request,
        CancellationToken cancellationToken)
    {
        UpdateRoomStatusCommand command = new(roomId, branchId, request.NewStatus);
        ErrorOr<RoomResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpDelete("{roomId:guid}")]
    [ProducesResponseType(typeof(RoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateRoom(
        Guid branchId,
        Guid roomId,
        CancellationToken cancellationToken)
    {
        DeactivateRoomCommand command = new(roomId, branchId);
        ErrorOr<RoomResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}

public sealed record CreateRoomRequest(
    Guid TenantId,
    RoomType RoomType,
    string RoomNumber,
    int Floor,
    int Capacity,
    decimal NightlyRate,
    string Currency,
    string? Description = null);

public sealed record UpdateRoomStatusRequest(RoomStatus NewStatus);
