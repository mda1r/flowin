using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateTenant;

public sealed class CreateTenantCommandValidator : AbstractValidator<CreateTenantCommand>
{
    private static readonly string[] _validBusinessTypes =
        ["Retail", "Supermarket", "Restaurant", "Hotel", "Gaming", "Cafe"];

    public CreateTenantCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Subdomain)
            .NotEmpty()
            .MaximumLength(63)
            .Matches(@"^[a-z0-9-]+$").WithMessage("النطاق يجب أن يحتوي على أحرف لاتينية صغيرة وأرقام وشرطات فقط");
        RuleFor(x => x.AdminEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.BusinessType).NotEmpty().Must(bt => _validBusinessTypes.Contains(bt))
            .WithMessage("نوع النشاط التجاري غير صالح");
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.TimeZone).NotEmpty().MaximumLength(64);
    }
}
