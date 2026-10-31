using FluentValidation;

namespace NexusPOS.POS.Application.Commands.ReturnOrder;

internal sealed class ReturnOrderCommandValidator : AbstractValidator<ReturnOrderCommand>
{
    public ReturnOrderCommandValidator()
    {
        RuleFor(x => x.OriginalOrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Lines).NotEmpty().WithMessage("اختر صنفاً واحداً على الأقل للإرجاع");
        RuleFor(x => x.Lines)
            .Must(lines => lines.Select(l => l.LineId).Distinct().Count() == lines.Count)
            .When(x => x.Lines is not null)
            .WithMessage("لا يتكرر الصنف في المرتجع نفسه");
        RuleFor(x => x.Note).MaximumLength(500);
        // An empty reference would make every later return look like a replay of the first.
        RuleFor(x => x.ClientReference).NotEqual(Guid.Empty).When(x => x.ClientReference.HasValue);
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.LineId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("كمية الإرجاع يجب أن تكون أكبر من صفر");
        });
    }
}
