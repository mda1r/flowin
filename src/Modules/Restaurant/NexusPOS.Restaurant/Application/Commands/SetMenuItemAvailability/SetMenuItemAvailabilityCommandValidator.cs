using FluentValidation;

namespace NexusPOS.Restaurant.Application.Commands.SetMenuItemAvailability;

internal sealed class SetMenuItemAvailabilityCommandValidator : AbstractValidator<SetMenuItemAvailabilityCommand>
{
    public SetMenuItemAvailabilityCommandValidator()
    {
        RuleFor(x => x.MenuItemId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
