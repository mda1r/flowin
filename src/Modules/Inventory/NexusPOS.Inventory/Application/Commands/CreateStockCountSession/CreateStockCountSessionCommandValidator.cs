using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.CreateStockCountSession;

internal sealed class CreateStockCountSessionCommandValidator : AbstractValidator<CreateStockCountSessionCommand>
{
    public CreateStockCountSessionCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Type).NotEmpty().MaximumLength(32);
        RuleFor(x => x.PeriodStart).NotEmpty();
        RuleFor(x => x.PeriodEnd).GreaterThanOrEqualTo(x => x.PeriodStart);
        RuleFor(x => x.Notes).MaximumLength(512).When(x => x.Notes is not null);
        RuleFor(x => x.Items).NotNull();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.StockItemId).NotEmpty();
            item.RuleFor(i => i.VariantId).NotEmpty();
            item.RuleFor(i => i.SystemQuantity).GreaterThanOrEqualTo(0);
            item.RuleFor(i => i.UnitCost).GreaterThanOrEqualTo(0);
        });
    }
}
