using FluentValidation;

namespace NexusPOS.POS.Application.Commands.ReturnOrder;

internal sealed class ReturnOrderCommandValidator : AbstractValidator<ReturnOrderCommand>
{
    public ReturnOrderCommandValidator()
    {
        RuleFor(x => x.OriginalOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Lines).NotEmpty().WithMessage("At least one line must be selected for return.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.LineId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("Return quantity must be greater than zero.");
        });
    }
}
