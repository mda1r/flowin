using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Repositories;

internal sealed class CategoryRepository(CatalogDbContext dbContext) : ICategoryRepository
{
    public async Task<Category?> FindByIdAsync(CategoryId id, CancellationToken cancellationToken = default) =>
        await dbContext.Categories
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<bool> ExistsByNameAsync(
        string name,
        CategoryId? parentId,
        CancellationToken cancellationToken = default) =>
        await dbContext.Categories
            .AnyAsync(c => c.Name == name.Trim() && c.ParentId == parentId, cancellationToken);

    public async Task<IReadOnlyList<Category>> FindAllAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Categories
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);

    public void Add(Category category) => dbContext.Categories.Add(category);

    public void Update(Category category) => dbContext.Categories.Update(category);
}
