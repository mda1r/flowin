using FluentValidation;

namespace NexusPOS.Zatca.Application.Commands.SaveZatcaSettings;

internal sealed class SaveZatcaSettingsCommandValidator : AbstractValidator<SaveZatcaSettingsCommand>
{
    public SaveZatcaSettingsCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();

        RuleFor(x => x.SellerName)
            .NotEmpty().WithMessage("اكتب الاسم القانوني للمنشأة")
            .MaximumLength(200).WithMessage("الاسم القانوني طويل جداً");

        // ZATCA VAT registration numbers are 15 digits that start and end with 3.
        RuleFor(x => x.VatRegistrationNumber)
            .NotEmpty().WithMessage("اكتب الرقم الضريبي")
            .Matches(@"^3\d{13}3$").WithMessage("الرقم الضريبي 15 رقماً يبدأ بـ 3 وينتهي بـ 3");
    }
}
