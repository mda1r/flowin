using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.DeactivateSupplier;

internal sealed class DeactivateSupplierCommandValidator : AbstractValidator<DeactivateSupplierCommand>
{
    public DeactivateSupplierCommandValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
    }
}
