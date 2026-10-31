using FluentValidation;

namespace NexusPOS.Tax.Application.Commands.CreateTaxScope;

internal sealed class CreateTaxScopeCommandValidator : AbstractValidator<CreateTaxScopeCommand>
{
    public CreateTaxScopeCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.VatRegistrationNumber).NotEmpty().MaximumLength(15)
            .Matches("^3\\d{14}$").WithMessage("الرقم الضريبي 15 رقماً يبدأ بـ 3");
        RuleFor(x => x.LegalEntityName).NotEmpty().MaximumLength(512);
    }
}
