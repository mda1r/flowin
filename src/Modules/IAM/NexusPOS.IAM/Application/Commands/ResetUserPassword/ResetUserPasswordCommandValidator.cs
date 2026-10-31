using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.ResetUserPassword;

internal sealed class ResetUserPasswordCommandValidator : AbstractValidator<ResetUserPasswordCommand>
{
    public ResetUserPasswordCommandValidator()
    {
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8)
            .WithMessage("كلمة المرور 8 أحرف على الأقل");
    }
}
