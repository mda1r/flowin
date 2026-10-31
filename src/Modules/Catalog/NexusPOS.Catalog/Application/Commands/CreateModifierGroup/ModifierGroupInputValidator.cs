using FluentValidation;
using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.Application.Commands.CreateModifierGroup;

// What the create and update commands share; the domain checks the same rules again on save.
public interface IModifierGroupInput
{
    string Name { get; }
    bool IsRequired { get; }
    int MinSelect { get; }
    int MaxSelect { get; }
    int SortOrder { get; }
    IReadOnlyList<ModifierOptionDraft> Options { get; }
}

internal abstract class ModifierGroupInputValidator<T> : AbstractValidator<T>
    where T : IModifierGroupInput
{
    protected ModifierGroupInputValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("اسم المجموعة مطلوب")
            .MaximumLength(ModifierGroup.NameMaxLength).WithMessage("اسم المجموعة لا يتجاوز 100 حرف");

        RuleFor(x => x.MinSelect)
            .GreaterThanOrEqualTo(0).WithMessage("الحد الأدنى لا يمكن أن يكون سالباً")
            .LessThanOrEqualTo(x => x.MaxSelect).WithMessage("الحد الأدنى لا يمكن أن يتجاوز الحد الأعلى");

        RuleFor(x => x.MinSelect)
            .GreaterThanOrEqualTo(1).When(x => x.IsRequired)
            .WithMessage("المجموعة الإلزامية تحتاج حداً أدنى 1 على الأقل");

        RuleFor(x => x.MaxSelect)
            .GreaterThanOrEqualTo(1).WithMessage("الحد الأعلى يجب أن يكون 1 على الأقل")
            .LessThanOrEqualTo(ModifierGroup.MaxOptions).WithMessage("الحد الأعلى لا يتجاوز 50");

        RuleFor(x => x.SortOrder)
            .GreaterThanOrEqualTo(0).WithMessage("الترتيب لا يمكن أن يكون سالباً");

        RuleFor(x => x.Options)
            .NotEmpty().WithMessage("أضف خياراً واحداً على الأقل")
            .Must(o => o is null || o.Count <= ModifierGroup.MaxOptions).WithMessage("عدد الخيارات كبير، الحد 50 خياراً");

        RuleForEach(x => x.Options).ChildRules(option =>
        {
            option.RuleFor(o => o.Name)
                .NotEmpty().WithMessage("اسم الخيار مطلوب")
                .MaximumLength(ModifierGroup.NameMaxLength).WithMessage("اسم الخيار لا يتجاوز 100 حرف");

            option.RuleFor(o => o.PriceDelta)
                .GreaterThanOrEqualTo(0).WithMessage("سعر الإضافة لا يمكن أن يكون سالباً")
                .LessThanOrEqualTo(100_000).WithMessage("سعر الإضافة كبير جداً");

            option.RuleFor(o => o.SortOrder)
                .GreaterThanOrEqualTo(0).WithMessage("الترتيب لا يمكن أن يكون سالباً");
        });
    }
}
