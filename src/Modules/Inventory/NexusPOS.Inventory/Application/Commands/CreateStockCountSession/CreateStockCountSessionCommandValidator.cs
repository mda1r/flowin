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
    }
}
