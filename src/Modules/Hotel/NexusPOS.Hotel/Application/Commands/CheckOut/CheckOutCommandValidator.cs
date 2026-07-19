using FluentValidation;

namespace NexusPOS.Hotel.Application.Commands.CheckOut;

public sealed class CheckOutCommandValidator : AbstractValidator<CheckOutCommand>
{
    public CheckOutCommandValidator()
    {
        RuleFor(x => x.ReservationId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
