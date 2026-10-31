using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.RenewSubscription;

internal sealed class RenewSubscriptionCommandValidator : AbstractValidator<RenewSubscriptionCommand>
{
    public RenewSubscriptionCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Months)
            .InclusiveBetween(1, 36)
            .WithMessage("مدة التجديد يجب أن تكون بين شهر و36 شهراً");
    }
}
