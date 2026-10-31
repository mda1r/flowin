using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.StartSession;

internal sealed class StartSessionCommandValidator : AbstractValidator<StartSessionCommand>
{
    public StartSessionCommandValidator()
    {
        RuleFor(x => x.StationId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.PlayerName).NotEmpty().MaximumLength(128);
        RuleFor(x => x.DurationMinutes).GreaterThan(0);
        RuleFor(x => x.RatePerHour).GreaterThan(0);
    }
}
