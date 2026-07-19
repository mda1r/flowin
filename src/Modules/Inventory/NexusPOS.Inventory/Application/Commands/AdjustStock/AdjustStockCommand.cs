using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.AdjustStock;

public sealed record AdjustStockCommand(
    Guid StockItemId,
    Guid BranchId,
    decimal NewQuantity,
    string? Reference = null,
    string? Notes = null) : ICommand<StockItemResponse>;
