using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockCountSession;

// The item snapshot (system quantities and unit costs) is taken on the server from the branch's stock.
public sealed record CreateStockCountSessionCommand(
    Guid BranchId,
    string Type,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string? Notes) : ICommand<StockCountSessionResponse>;
