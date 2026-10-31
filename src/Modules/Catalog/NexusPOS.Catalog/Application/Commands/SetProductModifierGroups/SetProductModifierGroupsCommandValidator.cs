using FluentValidation;
using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.Application.Commands.SetProductModifierGroups;

internal sealed class SetProductModifierGroupsCommandValidator : AbstractValidator<SetProductModifierGroupsCommand>
{
    public SetProductModifierGroupsCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();

        RuleFor(x => x.GroupIds)
            .NotNull().WithMessage("قائمة المجموعات مطلوبة")
            .Must(ids => ids is null || ids.Count <= ProductModifierGroup.MaxGroupsPerProduct)
            .WithMessage("عدد مجموعات الإضافات كبير، الحد 20 مجموعة")
            .Must(ids => ids is null || ids.Distinct().Count() == ids.Count)
            .WithMessage("توجد مجموعة مكررة");
    }
}
