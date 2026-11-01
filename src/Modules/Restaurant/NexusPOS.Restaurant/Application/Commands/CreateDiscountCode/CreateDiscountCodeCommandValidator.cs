using System.Linq.Expressions;
using FluentValidation;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;

internal sealed class CreateDiscountCodeCommandValidator : AbstractValidator<CreateDiscountCodeCommand>
{
    public CreateDiscountCodeCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        DiscountCodeRules.Apply(this, x => x.Code, x => x.Label, x => x.Type, x => x.Value, x => x.MinOrderAmount, x => x.MaxUses);
        RuleFor(x => x.ExpiryDate)
            .GreaterThan(DateTime.UtcNow).When(x => x.ExpiryDate is not null)
            .WithMessage("تاريخ الانتهاء يجب أن يكون في المستقبل.");
    }
}

// The rules a code's fields follow, shared by create and update.
internal static class DiscountCodeRules
{
    public static void Apply<T>(
        AbstractValidator<T> validator,
        Expression<Func<T, string>> code,
        Expression<Func<T, string?>> label,
        Expression<Func<T, DiscountCodeType>> type,
        Expression<Func<T, decimal>> value,
        Expression<Func<T, decimal>> minOrderAmount,
        Expression<Func<T, int>> maxUses)
    {
        Func<T, DiscountCodeType> typeOf = type.Compile();
        validator.RuleFor(code)
            .Must(c => !string.IsNullOrWhiteSpace(c)).WithMessage("الكود مطلوب.")
            .Must(c => (c ?? string.Empty).Trim().Length <= DiscountCode.CodeMaxLength)
            .WithMessage($"الكود لا يتجاوز {DiscountCode.CodeMaxLength} حرفاً.")
            .Must(c => !(c ?? string.Empty).Trim().Any(char.IsWhiteSpace)).WithMessage("الكود بدون مسافات.");
        validator.RuleFor(label)
            .Must(l => (l ?? string.Empty).Trim().Length <= DiscountCode.LabelMaxLength)
            .WithMessage($"الوصف لا يتجاوز {DiscountCode.LabelMaxLength} حرفاً.");
        validator.RuleFor(type).IsInEnum().WithMessage("نوع الخصم غير صحيح.");
        validator.RuleFor(value)
            .InclusiveBetween(1m, 100m).When(x => typeOf(x) == DiscountCodeType.Percentage)
            .WithMessage("نسبة الخصم بين 1 و 100.");
        validator.RuleFor(value)
            .GreaterThan(0m).When(x => typeOf(x) != DiscountCodeType.Percentage)
            .WithMessage("قيمة الخصم يجب أن تكون أكبر من صفر.");
        validator.RuleFor(minOrderAmount).GreaterThanOrEqualTo(0m).WithMessage("الحد الأدنى للطلب لا يكون سالباً.");
        validator.RuleFor(maxUses).GreaterThanOrEqualTo(0).WithMessage("عدد مرات الاستخدام لا يكون سالباً.");
    }
}
