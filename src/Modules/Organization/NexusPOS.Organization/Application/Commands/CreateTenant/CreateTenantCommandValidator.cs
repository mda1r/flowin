using FluentValidation;

namespace NexusPOS.Organization.Application.Commands.CreateTenant;

internal sealed class CreateTenantCommandValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("اسم المنشأة مطلوب")
            .MaximumLength(256).WithMessage("اسم المنشأة يجب ألا يتجاوز 256 حرفاً");

        RuleFor(x => x.Subdomain)
            .NotEmpty().WithMessage("النطاق الفرعي مطلوب")
            .MinimumLength(3).WithMessage("النطاق الفرعي 3 أحرف على الأقل")
            .MaximumLength(63).WithMessage("النطاق الفرعي يجب ألا يتجاوز 63 حرفاً")
            .Matches("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
            .WithMessage("النطاق الفرعي حروف إنجليزية صغيرة وأرقام وشرطات، ولا يبدأ أو ينتهي بشرطة");

        RuleFor(x => x.AdminEmail)
            .NotEmpty().WithMessage("بريد المسؤول مطلوب")
            .EmailAddress().WithMessage("بريد المسؤول غير صالح")
            .MaximumLength(256);

        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3).WithMessage("رمز العملة يجب أن يكون 3 أحرف، مثل SAR");

        RuleFor(x => x.TimeZone)
            .NotEmpty().WithMessage("المنطقة الزمنية مطلوبة")
            .MaximumLength(64);
    }
}
