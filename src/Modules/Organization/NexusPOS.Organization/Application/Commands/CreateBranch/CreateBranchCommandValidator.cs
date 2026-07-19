using FluentValidation;

namespace NexusPOS.Organization.Application.Commands.CreateBranch;

internal sealed class CreateBranchCommandValidator : AbstractValidator<CreateBranchCommand>
{
    public CreateBranchCommandValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Branch name is required.")
            .MaximumLength(256);

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("A valid branch type is required.");

        RuleFor(x => x.PhoneNumber)
            .MaximumLength(32)
            .When(x => x.PhoneNumber is not null);

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("A valid email address is required.")
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
