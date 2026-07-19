using FluentValidation;

namespace NexusPOS.Hotel.Application.Commands.CheckIn;

public sealed class CheckInCommandValidator : AbstractValidator<CheckInCommand>
{
    public CheckInCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.RoomId).NotEmpty();
        RuleFor(x => x.GuestName).NotEmpty().MaximumLength(256);
        RuleFor(x => x.GuestNationalId).NotEmpty().MaximumLength(128);
        RuleFor(x => x.GuestPhone).NotEmpty().MaximumLength(64);
        RuleFor(x => x.RatePerNight).GreaterThan(0);
        RuleFor(x => x.CheckOut).GreaterThan(x => x.CheckIn)
            .WithMessage("Check-out must be after check-in.");
    }
}
