using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.SaveStockCountItems;

public sealed record SaveStockCountItemInput(Guid StockItemId, decimal CountedQuantity);

public sealed record SaveStockCountItemsCommand(
    Guid BranchId,
    Guid SessionId,
    IReadOnlyList<SaveStockCountItemInput> Items) : ICommand<StockCountSessionResponse>;
