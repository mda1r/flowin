using FluentValidation;

namespace NexusPOS.POS.Application.Commands.RemoveOrderLine;

internal sealed class RemoveOrderLineCommandValidator : AbstractValidator<RemoveOrderLineCommand>
{
    public RemoveOrderLineCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.OrderLineId).NotEmpty();
    }
}
