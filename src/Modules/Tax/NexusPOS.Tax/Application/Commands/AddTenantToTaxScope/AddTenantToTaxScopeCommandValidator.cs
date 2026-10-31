using FluentValidation;

namespace NexusPOS.Tax.Application.Commands.AddTenantToTaxScope;

internal sealed class AddTenantToTaxScopeCommandValidator : AbstractValidator<AddTenantToTaxScopeCommand>
{
    public AddTenantToTaxScopeCommandValidator()
    {
        RuleFor(x => x.TaxScopeId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.EffectiveFrom)
            .Must(d => d >= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)))
            .WithMessage("تاريخ البدء لا يمكن أن يكون في الماضي");
    }
}
