using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListBranchStock;

public sealed record ListBranchStockQuery(Guid BranchId, bool LowStockOnly = false) : IQuery<IReadOnlyList<StockItemResponse>>;
