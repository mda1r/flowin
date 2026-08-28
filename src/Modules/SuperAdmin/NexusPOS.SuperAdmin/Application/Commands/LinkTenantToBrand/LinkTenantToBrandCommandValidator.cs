using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.LinkTenantToBrand;

internal sealed class LinkTenantToBrandCommandValidator : AbstractValidator<LinkTenantToBrandCommand>
{
    public LinkTenantToBrandCommandValidator()
    {
        RuleFor(x => x.BrandId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BranchDisplayName).MaximumLength(256).When(x => x.BranchDisplayName != null);
        RuleFor(x => x.BranchCode).MaximumLength(64).When(x => x.BranchCode != null);
    }
}
