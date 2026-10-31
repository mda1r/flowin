using FluentValidation;

namespace NexusPOS.Organization.Application.Commands.CreateBranch;

internal sealed class CreateBranchCommandValidator : AbstractValidator<CreateBranchCommand>
{
    public CreateBranchCommandValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("اسم الفرع مطلوب")
            .MaximumLength(256);

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("نوع الفرع غير صالح");

        RuleFor(x => x.PhoneNumber)
            .MaximumLength(32)
            .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("البريد الإلكتروني غير صالح")
            .MaximumLength(256)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Country)
            .MaximumLength(128)
            .When(x => !string.IsNullOrWhiteSpace(x.Country));

        RuleFor(x => x.PostalCode)
            .MaximumLength(16)
            .When(x => !string.IsNullOrWhiteSpace(x.PostalCode));
    }
}
