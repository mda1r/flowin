using FluentValidation;

namespace NexusPOS.Hotel.Application.Commands.DeactivateRoom;

internal sealed class DeactivateRoomCommandValidator : AbstractValidator<DeactivateRoomCommand>
{
    public DeactivateRoomCommandValidator()
    {
        RuleFor(x => x.RoomId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
