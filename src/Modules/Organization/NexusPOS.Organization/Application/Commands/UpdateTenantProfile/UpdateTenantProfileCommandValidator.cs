using FluentValidation;

namespace NexusPOS.Organization.Application.Commands.UpdateTenantProfile;

internal sealed class UpdateTenantProfileCommandValidator : AbstractValidator<UpdateTenantProfileCommand>
{
    public UpdateTenantProfileCommandValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty().WithMessage("المنشأة مطلوبة");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("اسم المنشأة مطلوب")
            .MaximumLength(256);

        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3).WithMessage("رمز العملة يجب أن يكون 3 أحرف، مثل SAR");

        RuleFor(x => x.TimeZone)
            .NotEmpty()
            .MaximumLength(64);

        RuleFor(x => x.LogoUrl)
            .MaximumLength(2048)
            .Must(url => url is null || Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("رابط الشعار غير صالح")
            .When(x => x.LogoUrl is not null);

        RuleFor(x => x.PhoneNumber)
            .MaximumLength(32)
            .When(x => x.PhoneNumber is not null);

        RuleFor(x => x.TaxId)
            .MaximumLength(64)
            .When(x => x.TaxId is not null);
    }
}
