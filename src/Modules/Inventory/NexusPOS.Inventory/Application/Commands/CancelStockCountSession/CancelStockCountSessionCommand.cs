using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CancelStockCountSession;

public sealed record CancelStockCountSessionCommand(
    Guid BranchId,
    Guid SessionId) : ICommand<StockCountSessionResponse>;
