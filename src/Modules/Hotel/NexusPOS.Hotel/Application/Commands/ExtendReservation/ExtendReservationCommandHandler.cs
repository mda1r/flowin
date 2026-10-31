using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.ExtendReservation;

internal sealed class ExtendReservationCommandHandler(
    IReservationRepository reservationRepository,
    HotelDbContext dbContext)
    : ICommandHandler<ExtendReservationCommand, ReservationResponse>
{
    public async Task<ErrorOr<ReservationResponse>> Handle(
        ExtendReservationCommand request,
        CancellationToken cancellationToken)
    {
        Reservation? reservation = await reservationRepository.FindByIdAsync(
            new ReservationId(request.ReservationId), cancellationToken);

        if (reservation is null || reservation.BranchId != request.BranchId)
        {
            return HotelErrors.ReservationNotFound;
        }

        ErrorOr<Success> extendResult = reservation.Extend(request.NewCheckOut);
        if (extendResult.IsError)
        {
            return extendResult.Errors;
        }

        reservationRepository.Update(reservation);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToReservationResponse(reservation);
    }
}
