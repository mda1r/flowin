using FluentValidation;

namespace NexusPOS.Hotel.Application.Commands.ExtendReservation;

public sealed class ExtendReservationCommandValidator : AbstractValidator<ExtendReservationCommand>
{
    public ExtendReservationCommandValidator()
    {
        RuleFor(x => x.ReservationId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.NewCheckOut).NotEmpty();
    }
}
