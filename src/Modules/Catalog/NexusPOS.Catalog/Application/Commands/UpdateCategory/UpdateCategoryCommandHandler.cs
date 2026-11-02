using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.UpdateCategory;

internal sealed class UpdateCategoryCommandHandler(
    ICategoryRepository categoryRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<UpdateCategoryCommand, CategoryResponse>
{
    public async Task<ErrorOr<CategoryResponse>> Handle(
        UpdateCategoryCommand request,
        CancellationToken cancellationToken)
    {
        Category? category = await categoryRepository.FindByIdAsync(new CategoryId(request.CategoryId), cancellationToken);
        if (category is null)
        {
            return CatalogErrors.CategoryNotFound;
        }

        string name = request.Name.Trim();
        if (!string.Equals(name, category.Name, StringComparison.Ordinal)
            && await categoryRepository.ExistsByNameAsync(name, category.ParentId, cancellationToken))
        {
            return CatalogErrors.CategoryNameExists;
        }

        category.Update(name, category.Description, category.SortOrder);
        if (request.NameEn is not null)
        {
            category.SetNameEn(request.NameEn);
        }

        categoryRepository.Update(category);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CategoryMapper.ToResponse(category);
    }
}
