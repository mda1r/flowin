using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListHotelRooms;

public sealed record ListHotelRoomsQuery(Guid BranchId) : IQuery<IReadOnlyList<RoomResponse>>;
