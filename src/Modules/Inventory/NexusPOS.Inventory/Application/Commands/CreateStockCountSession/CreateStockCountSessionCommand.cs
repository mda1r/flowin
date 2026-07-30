using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockCountSession;

public sealed record CreateStockCountSessionItemInput(
    Guid StockItemId,
    Guid VariantId,
    decimal SystemQuantity,
    decimal UnitCost);

public sealed record CreateStockCountSessionCommand(
    Guid BranchId,
    string Type,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string? Notes,
    IReadOnlyList<CreateStockCountSessionItemInput> Items) : ICommand<StockCountSessionResponse>;
