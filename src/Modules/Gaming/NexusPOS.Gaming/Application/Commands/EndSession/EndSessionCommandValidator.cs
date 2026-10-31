using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.EndSession;

internal sealed class EndSessionCommandValidator : AbstractValidator<EndSessionCommand>
{
    public EndSessionCommandValidator()
    {
        RuleFor(x => x.StationId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
