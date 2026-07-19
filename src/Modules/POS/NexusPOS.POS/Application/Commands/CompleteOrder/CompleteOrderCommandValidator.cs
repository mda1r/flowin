using FluentValidation;

namespace NexusPOS.POS.Application.Commands.CompleteOrder;

internal sealed class CompleteOrderCommandValidator : AbstractValidator<CompleteOrderCommand>
{
    public CompleteOrderCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.AmountTendered).GreaterThanOrEqualTo(0);
    }
}
