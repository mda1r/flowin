using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CompleteStockCountSession;

public sealed record CompleteStockCountSessionCommand(
    Guid BranchId,
    Guid SessionId,
    bool AutoAdjust) : ICommand<StockCountSessionResponse>;
