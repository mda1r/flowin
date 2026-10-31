using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateTenantAndLinkToBrand;

internal sealed class CreateTenantAndLinkToBrandCommandValidator : AbstractValidator<CreateTenantAndLinkToBrandCommand>
{
    public CreateTenantAndLinkToBrandCommandValidator()
    {
        RuleFor(x => x.BrandId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Subdomain).NotEmpty().MaximumLength(64)
            .Matches("^[a-z0-9-]+$").WithMessage("Subdomain must contain only lowercase letters, digits, and hyphens");
        RuleFor(x => x.AdminEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.BusinessType).NotEmpty();
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.TimeZone).NotEmpty().MaximumLength(64);
    }
}
