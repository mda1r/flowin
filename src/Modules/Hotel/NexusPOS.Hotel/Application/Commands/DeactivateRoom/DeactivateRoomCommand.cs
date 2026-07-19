using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.DeactivateRoom;

public sealed record DeactivateRoomCommand(Guid RoomId, Guid BranchId) : ICommand<RoomResponse>;
