using FluentValidation;

namespace NexusPOS.CRM.Application.Commands.CreateCustomer;

internal sealed class CreateCustomerCommandValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => x.Email is not null);
        RuleFor(x => x.Phone).MaximumLength(32).When(x => x.Phone is not null);
        RuleFor(x => x.Address).MaximumLength(512).When(x => x.Address is not null);
        RuleFor(x => x.Notes).MaximumLength(2048).When(x => x.Notes is not null);
    }
}
