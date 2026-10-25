using FluentValidation;

namespace NexusPOS.CRM.Application.Commands.UpdateLoyaltySettings;

internal sealed class UpdateLoyaltySettingsCommandValidator : AbstractValidator<UpdateLoyaltySettingsCommand>
{
    public UpdateLoyaltySettingsCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.PointsPerCurrencyUnit)
            .GreaterThan(0).LessThanOrEqualTo(1000)
            .WithMessage("النقاط لكل ريال يجب أن تكون أكبر من صفر ولا تتجاوز 1000.");
        RuleFor(x => x.RedeemPoints)
            .InclusiveBetween(1, 1_000_000)
            .WithMessage("عدد النقاط في معادلة الاستبدال يجب أن يكون بين 1 و 1,000,000.");
        RuleFor(x => x.RedeemValue)
            .GreaterThan(0).LessThanOrEqualTo(100_000)
            .WithMessage("قيمة النقاط بالريال يجب أن تكون أكبر من صفر.");
        RuleFor(x => x.MinRedeemPoints)
            .InclusiveBetween(0, 1_000_000)
            .WithMessage("الحد الأدنى للاستبدال يجب أن يكون صفراً أو أكثر.");
    }
}
