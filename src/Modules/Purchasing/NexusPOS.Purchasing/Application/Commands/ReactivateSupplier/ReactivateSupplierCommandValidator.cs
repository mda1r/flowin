using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.ReactivateSupplier;

internal sealed class ReactivateSupplierCommandValidator : AbstractValidator<ReactivateSupplierCommand>
{
    public ReactivateSupplierCommandValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
    }
}
