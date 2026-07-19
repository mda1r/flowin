using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.ReceiveStock;

public sealed record ReceiveStockCommand(
    Guid StockItemId,
    Guid BranchId,
    decimal Quantity,
    string? Reference = null,
    string? Notes = null,
    DateTime? ExpiryDate = null) : ICommand<StockItemResponse>;
