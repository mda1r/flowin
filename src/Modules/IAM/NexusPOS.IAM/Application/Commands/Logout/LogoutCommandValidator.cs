using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.Logout;

internal sealed class LogoutCommandValidator : AbstractValidator<LogoutCommand>
{
    public LogoutCommandValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("انتهت الجلسة، سجّل الدخول مرة أخرى");
    }
}
