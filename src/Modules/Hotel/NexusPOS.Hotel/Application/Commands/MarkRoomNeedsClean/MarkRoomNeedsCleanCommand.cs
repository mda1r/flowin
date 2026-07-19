using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.MarkRoomNeedsClean;

public sealed record MarkRoomNeedsCleanCommand(Guid RoomId, Guid BranchId) : ICommand<RoomResponse>;
