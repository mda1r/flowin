using FluentValidation;

namespace NexusPOS.Hotel.Application.Commands.UpdateRoomStatus;

internal sealed class UpdateRoomStatusCommandValidator : AbstractValidator<UpdateRoomStatusCommand>
{
    public UpdateRoomStatusCommandValidator()
    {
        RuleFor(x => x.RoomId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
