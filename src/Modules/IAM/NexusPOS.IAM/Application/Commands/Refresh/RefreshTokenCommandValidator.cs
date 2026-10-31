using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.Refresh;

internal sealed class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("انتهت الجلسة، سجّل الدخول مرة أخرى")
            .Length(64).WithMessage("انتهت الجلسة، سجّل الدخول مرة أخرى");
    }
}
