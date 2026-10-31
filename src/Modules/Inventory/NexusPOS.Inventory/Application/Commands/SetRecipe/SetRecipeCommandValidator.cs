using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.SetRecipe;

internal sealed class SetRecipeCommandValidator : AbstractValidator<SetRecipeCommand>
{
    public SetRecipeCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.VariantId).NotEmpty();
        RuleFor(x => x.Lines).NotNull().Must(l => l.Count <= 50).WithMessage("الوصفة لا تتجاوز 50 مكوّناً");
        RuleFor(x => x.Lines)
            .Must(l => l.Select(x => x.MaterialId).Distinct().Count() == l.Count)
            .WithMessage("كل مادة تُضاف مرة واحدة فقط في الوصفة");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.MaterialId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0);
        });
    }
}
