using FluentValidation;

namespace NexusPOS.Purchasing.Application.Commands.UpdateSupplier;

internal sealed class UpdateSupplierCommandValidator : AbstractValidator<UpdateSupplierCommand>
{
    public UpdateSupplierCommandValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.ContactEmail).EmailAddress().MaximumLength(256).When(x => x.ContactEmail is not null);
        RuleFor(x => x.ContactPhone).MaximumLength(32).When(x => x.ContactPhone is not null);
        RuleFor(x => x.Address).MaximumLength(512).When(x => x.Address is not null);
    }
}
