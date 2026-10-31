using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.SetRecipe;

internal sealed class SetRecipeCommandValidator : AbstractValidator<SetRecipeCommand>
{
    public SetRecipeCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.VariantId).NotEmpty();
        RuleFor(x => x.Lines).NotNull().Must(l => l.Count <= 50).WithMessage("A recipe can have at most 50 ingredients.");
        RuleFor(x => x.Lines)
            .Must(l => l.Select(x => x.MaterialId).Distinct().Count() == l.Count)
            .WithMessage("Each material can appear only once in a recipe.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.MaterialId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0);
        });
    }
}
