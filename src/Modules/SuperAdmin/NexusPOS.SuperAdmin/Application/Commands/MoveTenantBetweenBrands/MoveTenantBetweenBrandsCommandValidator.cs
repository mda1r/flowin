using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.MoveTenantBetweenBrands;

internal sealed class MoveTenantBetweenBrandsCommandValidator : AbstractValidator<MoveTenantBetweenBrandsCommand>
{
    public MoveTenantBetweenBrandsCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.TargetBrandId).NotEmpty();
        RuleFor(x => x.NewBranchDisplayName).MaximumLength(256).When(x => x.NewBranchDisplayName != null);
        RuleFor(x => x.NewBranchCode).MaximumLength(64).When(x => x.NewBranchCode != null);
    }
}
