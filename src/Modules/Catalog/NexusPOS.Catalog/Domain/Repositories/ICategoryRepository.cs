using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Domain.Repositories;

public interface ICategoryRepository
{
    Task<Category?> FindByIdAsync(CategoryId id, CancellationToken cancellationToken = default);
    Task<bool> ExistsByNameAsync(string name, CategoryId? parentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Category>> FindAllAsync(CancellationToken cancellationToken = default);
    void Add(Category category);
    void Update(Category category);
}
