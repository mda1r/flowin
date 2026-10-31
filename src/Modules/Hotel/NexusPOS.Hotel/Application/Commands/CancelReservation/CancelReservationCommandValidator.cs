using FluentValidation;

namespace NexusPOS.Hotel.Application.Commands.CancelReservation;

public sealed class CancelReservationCommandValidator : AbstractValidator<CancelReservationCommand>
{
    public CancelReservationCommandValidator()
    {
        RuleFor(x => x.ReservationId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
