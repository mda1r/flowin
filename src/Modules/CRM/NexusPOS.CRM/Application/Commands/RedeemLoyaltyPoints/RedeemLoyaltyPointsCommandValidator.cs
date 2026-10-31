using FluentValidation;

namespace NexusPOS.CRM.Application.Commands.RedeemLoyaltyPoints;

internal sealed class RedeemLoyaltyPointsCommandValidator : AbstractValidator<RedeemLoyaltyPointsCommand>
{
    public RedeemLoyaltyPointsCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Points).GreaterThan(0);
    }
}
