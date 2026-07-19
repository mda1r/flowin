using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.InitializeStock;

public sealed record InitializeStockCommand(
    Guid VariantId,
    Guid BranchId,
    decimal ReorderPoint = 0,
    decimal ReorderQuantity = 0) : ICommand<StockItemResponse>;
