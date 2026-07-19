using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Hotel.Infrastructure.Persistence;

namespace NexusPOS.Hotel.Application.Commands.CreateRoom;

internal sealed class CreateRoomCommandHandler(
    IRoomRepository roomRepository,
    HotelDbContext dbContext)
    : ICommandHandler<CreateRoomCommand, RoomResponse>
{
    public async Task<ErrorOr<RoomResponse>> Handle(
        CreateRoomCommand request,
        CancellationToken cancellationToken)
    {
        bool exists = await roomRepository.ExistsByRoomNumberAsync(
            request.BranchId, request.RoomNumber, cancellationToken);

        if (exists)
        {
            return HotelErrors.RoomNumberTaken;
        }

        ErrorOr<Room> room = Room.Create(
            request.TenantId, request.BranchId, request.RoomType,
            request.RoomNumber, request.Floor, request.Capacity,
            request.NightlyRate, request.Currency, request.Description);

        if (room.IsError)
        {
            return room.Errors;
        }

        roomRepository.Add(room.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToResponse(room.Value);
    }
}
