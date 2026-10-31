using FluentValidation;
using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Application.Commands.Checkout;

internal sealed class CheckoutOrderCommandValidator : AbstractValidator<CheckoutOrderCommand>
{
    public CheckoutOrderCommandValidator()
    {
        RuleFor(x => x.ClientReference).NotEmpty();
        RuleFor(x => x.Lines).NotEmpty().Must(l => l.Count <= 300);
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(x => x.VariantId).NotEmpty();
            l.RuleFor(x => x.Quantity).GreaterThan(0);
            l.RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0);
            l.RuleFor(x => x.Notes).MaximumLength(200);
            l.RuleFor(x => x.DiscountType).IsInEnum();
            l.RuleFor(x => x.DiscountValue).GreaterThanOrEqualTo(0);
            l.RuleFor(x => x.DiscountValue).LessThanOrEqualTo(100).When(x => x.DiscountType == DiscountType.Percentage)
                .WithMessage("نسبة الخصم لا تتجاوز 100%.");
        });
        RuleFor(x => x.DiscountType).IsInEnum();
        RuleFor(x => x.DiscountValue).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DiscountValue).LessThanOrEqualTo(100).When(x => x.DiscountType == DiscountType.Percentage)
            .WithMessage("نسبة الخصم لا تتجاوز 100%.");
        RuleFor(x => x.ApprovalPin).MaximumLength(12);
        RuleFor(x => x.LoyaltyPoints).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AmountTendered).GreaterThanOrEqualTo(0).WithMessage("المبلغ المدفوع لا يكون سالباً.");

        // A split names both parts; whether they add up to the total is checked once the total is known.
        RuleFor(x => x.CashAmount).NotNull().When(x => x.PaymentMethod == PaymentMethod.Split)
            .WithMessage("أدخل المبلغ النقدي في الدفع المقسّم.");
        RuleFor(x => x.CardAmount).NotNull().When(x => x.PaymentMethod == PaymentMethod.Split)
            .WithMessage("أدخل مبلغ البطاقة في الدفع المقسّم.");
        RuleFor(x => x.CashAmount).GreaterThanOrEqualTo(0).WithMessage("المبلغ النقدي لا يكون سالباً.");
        RuleFor(x => x.CardAmount).GreaterThanOrEqualTo(0).WithMessage("مبلغ البطاقة لا يكون سالباً.");
        RuleFor(x => x.TaxRate).InclusiveBetween(0m, 1m);
    }
}
