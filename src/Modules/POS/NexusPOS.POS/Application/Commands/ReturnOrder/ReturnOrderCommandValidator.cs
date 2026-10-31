using FluentValidation;

namespace NexusPOS.POS.Application.Commands.ReturnOrder;

internal sealed class ReturnOrderCommandValidator : AbstractValidator<ReturnOrderCommand>
{
    public ReturnOrderCommandValidator()
    {
        RuleFor(x => x.OriginalOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Lines).NotEmpty().WithMessage("At least one line must be selected for return.");
        RuleFor(x => x.Lines)
            .Must(lines => lines.Select(l => l.LineId).Distinct().Count() == lines.Count)
            .When(x => x.Lines is not null)
            .WithMessage("Each line can appear only once in a return.");
        RuleFor(x => x.Note).MaximumLength(500);
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.LineId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("Return quantity must be greater than zero.");
        });
    }
}
