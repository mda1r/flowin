using FluentValidation;

namespace NexusPOS.Hotel.Application.Commands.CreateRoom;

internal sealed class CreateRoomCommandValidator : AbstractValidator<CreateRoomCommand>
{
    public CreateRoomCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.RoomNumber).NotEmpty().MaximumLength(32);
        RuleFor(x => x.Floor).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Capacity).GreaterThan(0);
        RuleFor(x => x.NightlyRate).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Description).MaximumLength(512).When(x => x.Description is not null);
    }
}
