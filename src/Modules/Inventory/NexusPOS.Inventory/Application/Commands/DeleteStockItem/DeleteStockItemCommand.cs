using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.DeleteStockItem;

public sealed record DeleteStockItemCommand(Guid StockItemId, Guid BranchId) : ICommand;
