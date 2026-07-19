using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Catalog.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.CreateCategory;

internal sealed class CreateCategoryCommandHandler(
    ICategoryRepository categoryRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<CreateCategoryCommand, CategoryResponse>
{
    public async Task<ErrorOr<CategoryResponse>> Handle(
        CreateCategoryCommand request,
        CancellationToken cancellationToken)
    {
        CategoryId? parentId = request.ParentId.HasValue
            ? new CategoryId(request.ParentId.Value)
            : null;

        if (parentId is not null)
        {
            Category? parent = await categoryRepository.FindByIdAsync(parentId, cancellationToken);
            if (parent is null)
            {
                return CatalogErrors.CategoryNotFound;
            }
        }

        bool nameExists = await categoryRepository.ExistsByNameAsync(
            request.Name, parentId, cancellationToken);
        if (nameExists)
        {
            return CatalogErrors.CategoryNameExists;
        }

        Category category = Category.Create(
            request.Name, request.Description, parentId, request.SortOrder);

        categoryRepository.Add(category);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(category);
    }

    private static CategoryResponse MapToResponse(Category c) => new(
        c.Id.Value, c.Name, c.Description, c.ParentId?.Value, c.IsActive, c.SortOrder, c.CreatedAt);
}
