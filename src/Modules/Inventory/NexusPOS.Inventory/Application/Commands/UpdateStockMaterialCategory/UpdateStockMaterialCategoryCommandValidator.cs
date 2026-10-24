using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.UpdateStockMaterialCategory;

internal sealed class UpdateStockMaterialCategoryCommandValidator : AbstractValidator<UpdateStockMaterialCategoryCommand>
{
    public UpdateStockMaterialCategoryCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}
