using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CheckOut;

internal sealed class CheckOutCommandHandler(
    IReservationRepository reservationRepository,
    IRoomRepository roomRepository,
    HotelDbContext dbContext)
    : ICommandHandler<CheckOutCommand, ReservationResponse>
{
    public async Task<ErrorOr<ReservationResponse>> Handle(
        CheckOutCommand request,
        CancellationToken cancellationToken)
    {
        Reservation? reservation = await reservationRepository.FindByIdAsync(
            new ReservationId(request.ReservationId), cancellationToken);

        if (reservation is null || reservation.BranchId != request.BranchId)
        {
            return HotelErrors.ReservationNotFound;
        }

        ErrorOr<Success> completeResult = reservation.Complete();
        if (completeResult.IsError)
        {
            return completeResult.Errors;
        }

        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(reservation.RoomId), cancellationToken);

        if (room is not null)
        {
            room.VacateRoom();
            roomRepository.Update(room);
        }

        reservationRepository.Update(reservation);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToReservationResponse(reservation);
    }
}
