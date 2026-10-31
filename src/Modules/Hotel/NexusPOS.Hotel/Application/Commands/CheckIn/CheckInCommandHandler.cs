using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CheckIn;

internal sealed class CheckInCommandHandler(
    IRoomRepository roomRepository,
    IReservationRepository reservationRepository,
    HotelDbContext dbContext)
    : ICommandHandler<CheckInCommand, ReservationResponse>
{
    public async Task<ErrorOr<ReservationResponse>> Handle(
        CheckInCommand request,
        CancellationToken cancellationToken)
    {
        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(request.RoomId), cancellationToken);

        if (room is null || room.BranchId != request.BranchId)
        {
            return HotelErrors.RoomNotFound;
        }

        ErrorOr<Success> occupyResult = room.OccupyRoom();
        if (occupyResult.IsError)
        {
            return occupyResult.Errors;
        }

        ErrorOr<Reservation> reservationResult = Reservation.Create(
            request.TenantId,
            request.BranchId,
            request.RoomId,
            request.GuestName,
            request.GuestNationalId,
            request.GuestPhone,
            request.CheckIn,
            request.CheckOut,
            request.RatePerNight,
            request.Notes);

        if (reservationResult.IsError)
        {
            return reservationResult.Errors;
        }

        reservationRepository.Add(reservationResult.Value);
        roomRepository.Update(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToReservationResponse(reservationResult.Value);
    }
}
