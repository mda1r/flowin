using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetStockItem;

public sealed record GetStockItemQuery(Guid StockItemId, Guid BranchId) : IQuery<StockItemResponse>;
