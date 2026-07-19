using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.ListCategories;

internal sealed class ListCategoriesQueryHandler(ICategoryRepository categoryRepository)
    : IQueryHandler<ListCategoriesQuery, IReadOnlyList<CategoryResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<CategoryResponse>>> Handle(
        ListCategoriesQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Category> categories = await categoryRepository.FindAllAsync(cancellationToken);

        IReadOnlyList<CategoryResponse> responses = categories
            .Select(c => new CategoryResponse(
                c.Id.Value, c.Name, c.Description, c.ParentId?.Value,
                c.IsActive, c.SortOrder, c.CreatedAt))
            .ToList();

        return ErrorOrFactory.From(responses);
    }
}
