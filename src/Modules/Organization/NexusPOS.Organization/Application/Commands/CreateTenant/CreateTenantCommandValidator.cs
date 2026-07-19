using FluentValidation;

namespace NexusPOS.Organization.Application.Commands.CreateTenant;

internal sealed class CreateTenantCommandValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tenant name is required.")
            .MaximumLength(256).WithMessage("Tenant name must not exceed 256 characters.");

        RuleFor(x => x.Subdomain)
            .NotEmpty().WithMessage("Subdomain is required.")
            .MinimumLength(3).WithMessage("Subdomain must be at least 3 characters.")
            .MaximumLength(63).WithMessage("Subdomain must not exceed 63 characters.")
            .Matches("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
            .WithMessage("Subdomain must be lowercase alphanumeric with hyphens, and cannot start or end with a hyphen.");

        RuleFor(x => x.AdminEmail)
            .NotEmpty().WithMessage("Admin email is required.")
            .EmailAddress().WithMessage("A valid admin email address is required.")
            .MaximumLength(256);

        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3).WithMessage("Currency must be a 3-letter ISO code (e.g., USD).");

        RuleFor(x => x.TimeZone)
            .NotEmpty().WithMessage("Time zone is required.")
            .MaximumLength(64);
    }
}
