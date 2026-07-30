using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockCountSessions;

public sealed record ListStockCountSessionsQuery(Guid BranchId) : IQuery<IReadOnlyList<StockCountSessionResponse>>;
