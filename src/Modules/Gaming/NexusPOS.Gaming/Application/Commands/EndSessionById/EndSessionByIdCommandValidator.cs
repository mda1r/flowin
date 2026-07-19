using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.EndSessionById;

internal sealed class EndSessionByIdCommandValidator : AbstractValidator<EndSessionByIdCommand>
{
    public EndSessionByIdCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
