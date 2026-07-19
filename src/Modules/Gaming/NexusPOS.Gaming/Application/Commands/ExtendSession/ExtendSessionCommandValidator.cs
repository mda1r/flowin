using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.ExtendSession;

internal sealed class ExtendSessionCommandValidator : AbstractValidator<ExtendSessionCommand>
{
    public ExtendSessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.ExtraMinutes).GreaterThan(0);
    }
}
