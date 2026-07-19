using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateSubscription;

internal sealed class CreateSubscriptionCommandValidator : AbstractValidator<CreateSubscriptionCommand>
{
    public CreateSubscriptionCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.PlanId).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.ExpiryDate)
            .NotEmpty()
            .GreaterThan(x => x.StartDate)
            .WithMessage("تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية");
    }
}
