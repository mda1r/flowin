using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.SetStockItemArchived;

public sealed record SetStockItemArchivedCommand(Guid StockItemId, Guid BranchId, bool Archived)
    : ICommand<StockItemResponse>;
