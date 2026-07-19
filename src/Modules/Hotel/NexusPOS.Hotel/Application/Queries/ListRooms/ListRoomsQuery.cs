using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListRooms;

public sealed record ListRoomsQuery(
    Guid BranchId,
    RoomType? RoomType = null,
    RoomStatus? Status = null,
    int Page = 1,
    int PageSize = 20) : IQuery<IReadOnlyList<RoomResponse>>;
