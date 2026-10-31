using ErrorOr;
using NexusPOS.Inventory.Application.Commands.CreateStockCountSession;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CancelStockCountSession;

internal sealed class CancelStockCountSessionCommandHandler(
    IStockCountRepository stockCountRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<CancelStockCountSessionCommand, StockCountSessionResponse>
{
    public async Task<ErrorOr<StockCountSessionResponse>> Handle(
        CancelStockCountSessionCommand request,
        CancellationToken cancellationToken)
    {
        StockCountSession? session = await stockCountRepository.FindByIdAsync(
            new StockCountSessionId(request.SessionId), cancellationToken);

        if (session is null || session.BranchId != request.BranchId)
        {
            return InventoryErrors.StockCountNotFound;
        }

        // Cancelling never touches stock; the entered counts stay on the session for reference.
        ErrorOr<Success> result = session.Cancel();
        if (result.IsError)
        {
            return result.Errors;
        }

        stockCountRepository.Update(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreateStockCountSessionCommandHandler.MapToResponse(session);
    }
}
