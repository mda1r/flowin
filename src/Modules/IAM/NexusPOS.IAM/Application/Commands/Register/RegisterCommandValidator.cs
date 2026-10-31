using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.Register;

internal sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("البريد الإلكتروني مطلوب")
            .EmailAddress().WithMessage("البريد الإلكتروني غير صالح")
            .MaximumLength(256).WithMessage("البريد الإلكتروني يجب ألا يتجاوز 256 حرفاً");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("كلمة المرور مطلوبة")
            .MinimumLength(8).WithMessage("كلمة المرور 8 أحرف على الأقل")
            .MaximumLength(128).WithMessage("كلمة المرور يجب ألا تتجاوز 128 حرفاً")
            .Matches("[A-Z]").WithMessage("كلمة المرور تحتاج حرفاً إنجليزياً كبيراً واحداً على الأقل")
            .Matches("[a-z]").WithMessage("كلمة المرور تحتاج حرفاً إنجليزياً صغيراً واحداً على الأقل")
            .Matches("[0-9]").WithMessage("كلمة المرور تحتاج رقماً واحداً على الأقل")
            .Matches("[^A-Za-z0-9]").WithMessage("كلمة المرور تحتاج رمزاً خاصاً واحداً على الأقل");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("الاسم الأول مطلوب")
            .MaximumLength(100).WithMessage("الاسم الأول يجب ألا يتجاوز 100 حرف");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("اسم العائلة مطلوب")
            .MaximumLength(100).WithMessage("اسم العائلة يجب ألا يتجاوز 100 حرف");
    }
}
