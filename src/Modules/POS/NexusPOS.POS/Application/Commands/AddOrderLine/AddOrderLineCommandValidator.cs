using FluentValidation;

namespace NexusPOS.POS.Application.Commands.AddOrderLine;

internal sealed class AddOrderLineCommandValidator : AbstractValidator<AddOrderLineCommand>
{
    public AddOrderLineCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.VariantId).NotEmpty();
        RuleFor(x => x.ProductName).NotEmpty().MaximumLength(256);
        RuleFor(x => x.VariantName).NotEmpty().MaximumLength(256);
        RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
