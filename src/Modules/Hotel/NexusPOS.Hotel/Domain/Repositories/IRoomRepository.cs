using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Domain.Repositories;

public interface IRoomRepository
{
    Task<Room?> FindByIdAsync(RoomId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Room>> FindByBranchAsync(Guid branchId, RoomType? roomType, RoomStatus? status, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<bool> ExistsByRoomNumberAsync(Guid branchId, string roomNumber, CancellationToken cancellationToken = default);
    void Add(Room room);
    void Update(Room room);
}
