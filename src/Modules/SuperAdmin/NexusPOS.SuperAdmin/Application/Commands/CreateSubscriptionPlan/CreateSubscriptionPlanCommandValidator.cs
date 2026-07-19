using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateSubscriptionPlan;

internal sealed class CreateSubscriptionPlanCommandValidator : AbstractValidator<CreateSubscriptionPlanCommand>
{
    public CreateSubscriptionPlanCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxBranches).GreaterThan(0);
        RuleFor(x => x.MaxUsers).GreaterThan(0);
    }
}
