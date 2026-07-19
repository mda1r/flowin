using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.ListCategories;

public sealed record ListCategoriesQuery : IQuery<IReadOnlyList<CategoryResponse>>;
