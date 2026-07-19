using FluentValidation;

namespace NexusPOS.CRM.Application.Commands.AddLoyaltyPoints;

internal sealed class AddLoyaltyPointsCommandValidator : AbstractValidator<AddLoyaltyPointsCommand>
{
    public AddLoyaltyPointsCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Points).GreaterThan(0);
    }
}
