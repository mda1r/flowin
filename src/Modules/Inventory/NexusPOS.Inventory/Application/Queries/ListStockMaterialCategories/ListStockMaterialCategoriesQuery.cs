using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMaterialCategories;

public sealed record ListStockMaterialCategoriesQuery(Guid TenantId)
    : IQuery<IReadOnlyList<StockMaterialCategoryResponse>>;
