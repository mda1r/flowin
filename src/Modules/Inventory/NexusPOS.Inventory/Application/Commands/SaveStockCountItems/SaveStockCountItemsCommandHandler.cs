using ErrorOr;
using NexusPOS.Inventory.Application.Commands.CreateStockCountSession;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.SaveStockCountItems;

internal sealed class SaveStockCountItemsCommandHandler(
    IStockCountRepository stockCountRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<SaveStockCountItemsCommand, StockCountSessionResponse>
{
    public async Task<ErrorOr<StockCountSessionResponse>> Handle(
        SaveStockCountItemsCommand request,
        CancellationToken cancellationToken)
    {
        StockCountSession? session = await stockCountRepository.FindByIdAsync(
            new StockCountSessionId(request.SessionId), cancellationToken);

        if (session is null || session.BranchId != request.BranchId)
        {
            return InventoryErrors.StockCountNotFound;
        }

        foreach (SaveStockCountItemInput input in request.Items)
        {
            ErrorOr<Success> result = session.UpdateItemCount(input.StockItemId, input.CountedQuantity);
            if (result.IsError)
            {
                return result.Errors;
            }
        }

        stockCountRepository.Update(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreateStockCountSessionCommandHandler.MapToResponse(session);
    }
}
