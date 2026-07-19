using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.ChangePassword;

internal sealed class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MinimumLength(8)
            .Matches("[A-Z]").WithMessage("يجب أن تحتوي كلمة المرور الجديدة على حرف كبير واحد على الأقل")
            .Matches("[a-z]").WithMessage("يجب أن تحتوي كلمة المرور الجديدة على حرف صغير واحد على الأقل")
            .Matches("[0-9]").WithMessage("يجب أن تحتوي كلمة المرور الجديدة على رقم واحد على الأقل")
            .Matches("[^a-zA-Z0-9]").WithMessage("يجب أن تحتوي كلمة المرور الجديدة على رمز خاص واحد على الأقل");
    }
}
