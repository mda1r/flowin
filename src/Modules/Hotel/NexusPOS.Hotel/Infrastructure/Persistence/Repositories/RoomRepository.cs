using Microsoft.EntityFrameworkCore;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Infrastructure.Persistence.Repositories;

internal sealed class RoomRepository(HotelDbContext dbContext) : IRoomRepository
{
    public async Task<Room?> FindByIdAsync(RoomId id, CancellationToken cancellationToken = default)
        => await dbContext.Rooms
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Room>> FindByBranchAsync(
        Guid branchId,
        RoomType? roomType,
        RoomStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Room> query = dbContext.Rooms.Where(r => r.BranchId == branchId);

        if (roomType.HasValue)
        {
            query = query.Where(r => r.RoomType == roomType.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }

        return await query
            .OrderBy(r => r.Floor)
            .ThenBy(r => r.RoomNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ExistsByRoomNumberAsync(
        Guid branchId,
        string roomNumber,
        CancellationToken cancellationToken = default)
        => await dbContext.Rooms
            .AnyAsync(r => r.BranchId == branchId && EF.Functions.ILike(r.RoomNumber, roomNumber), cancellationToken);

    public void Add(Room room) => dbContext.Rooms.Add(room);

    public void Update(Room room) => dbContext.Rooms.Update(room);
}
