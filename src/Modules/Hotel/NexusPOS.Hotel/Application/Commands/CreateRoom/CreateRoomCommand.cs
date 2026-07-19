using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CreateRoom;

public sealed record CreateRoomCommand(
    Guid TenantId,
    Guid BranchId,
    RoomType RoomType,
    string RoomNumber,
    int Floor,
    int Capacity,
    decimal NightlyRate,
    string Currency,
    string? Description = null) : ICommand<RoomResponse>;
