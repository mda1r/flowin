using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.SetMaintenance;

internal sealed class SetMaintenanceCommandValidator : AbstractValidator<SetMaintenanceCommand>
{
    public SetMaintenanceCommandValidator()
    {
        RuleFor(x => x.StationId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
