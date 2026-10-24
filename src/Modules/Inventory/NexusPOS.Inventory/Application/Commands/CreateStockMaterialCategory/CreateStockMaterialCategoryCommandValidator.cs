using FluentValidation;

namespace NexusPOS.Inventory.Application.Commands.CreateStockMaterialCategory;

internal sealed class CreateStockMaterialCategoryCommandValidator : AbstractValidator<CreateStockMaterialCategoryCommand>
{
    public CreateStockMaterialCategoryCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}
