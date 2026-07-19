using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.UpdateRoomStatus;

public sealed record UpdateRoomStatusCommand(Guid RoomId, Guid BranchId, RoomStatus NewStatus) : ICommand<RoomResponse>;
