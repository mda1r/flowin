using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetStockCountSession;

public sealed record GetStockCountSessionQuery(Guid BranchId, Guid SessionId) : IQuery<StockCountSessionResponse>;
