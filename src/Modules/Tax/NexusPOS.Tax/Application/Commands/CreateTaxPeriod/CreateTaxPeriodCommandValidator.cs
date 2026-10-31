using FluentValidation;

namespace NexusPOS.Tax.Application.Commands.CreateTaxPeriod;

internal sealed class CreateTaxPeriodCommandValidator : AbstractValidator<CreateTaxPeriodCommand>
{
    public CreateTaxPeriodCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).NotEmpty().GreaterThan(x => x.StartDate)
            .WithMessage("End date must be after start date");
    }
}
