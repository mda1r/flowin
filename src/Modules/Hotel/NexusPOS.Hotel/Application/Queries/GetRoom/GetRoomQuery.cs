using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.GetRoom;

public sealed record GetRoomQuery(Guid RoomId, Guid BranchId) : IQuery<RoomResponse>;
