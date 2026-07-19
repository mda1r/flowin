using FluentValidation;

namespace NexusPOS.POS.Application.Commands.CancelOrder;

internal sealed class CancelOrderCommandValidator : AbstractValidator<CancelOrderCommand>
{
    public CancelOrderCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Reason).MaximumLength(512).When(x => x.Reason is not null);
    }
}
