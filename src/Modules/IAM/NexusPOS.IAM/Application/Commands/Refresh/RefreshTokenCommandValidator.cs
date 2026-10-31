using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.Refresh;

internal sealed class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Refresh token is required.")
            .Length(64).WithMessage("Invalid refresh token format.");
    }
}
