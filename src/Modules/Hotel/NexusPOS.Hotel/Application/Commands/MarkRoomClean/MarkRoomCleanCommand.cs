using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.MarkRoomClean;

public sealed record MarkRoomCleanCommand(Guid RoomId, Guid BranchId) : ICommand<RoomResponse>;
