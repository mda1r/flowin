using FluentValidation;

namespace NexusPOS.Organization.Application.Commands.UpdateBranch;

internal sealed class UpdateBranchCommandValidator : AbstractValidator<UpdateBranchCommand>
{
    public UpdateBranchCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("اسم الفرع مطلوب")
            .MaximumLength(256);

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("نوع الفرع غير صالح");

        RuleFor(x => x.PhoneNumber)
            .MaximumLength(32)
            .When(x => x.PhoneNumber is not null);

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("البريد الإلكتروني غير صالح")
            .MaximumLength(256)
            .When(x => x.Email is not null);

        RuleFor(x => x.Country)
            .MaximumLength(128)
            .When(x => x.Country is not null);

        RuleFor(x => x.PostalCode)
            .MaximumLength(16)
            .When(x => x.PostalCode is not null);
    }
}
