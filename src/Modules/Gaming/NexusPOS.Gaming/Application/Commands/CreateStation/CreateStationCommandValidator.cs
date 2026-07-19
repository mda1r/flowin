using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.CreateStation;

internal sealed class CreateStationCommandValidator : AbstractValidator<CreateStationCommand>
{
    public CreateStationCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.HourlyRate).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
    }
}
