using ErrorOr;
using NexusPOS.Inventory.Application.Commands.CreateStockCountSession;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetStockCountSession;

internal sealed class GetStockCountSessionQueryHandler(IStockCountRepository stockCountRepository)
    : IQueryHandler<GetStockCountSessionQuery, StockCountSessionResponse>
{
    public async Task<ErrorOr<StockCountSessionResponse>> Handle(
        GetStockCountSessionQuery request,
        CancellationToken cancellationToken)
    {
        StockCountSession? session = await stockCountRepository.FindByIdAsync(
            new StockCountSessionId(request.SessionId), cancellationToken);

        if (session is null || session.BranchId != request.BranchId)
        {
            return InventoryErrors.StockCountNotFound;
        }

        return CreateStockCountSessionCommandHandler.MapToResponse(session);
    }
}
