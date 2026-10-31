using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockCountSession;

internal sealed class CreateStockCountSessionCommandHandler(
    IStockCountRepository stockCountRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<CreateStockCountSessionCommand, StockCountSessionResponse>
{
    public async Task<ErrorOr<StockCountSessionResponse>> Handle(
        CreateStockCountSessionCommand request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<StockCountType>(request.Type, ignoreCase: true, out StockCountType type))
        {
            return InventoryErrors.StockCountNotFound;
        }

        StockCountSession session = StockCountSession.Create(
            request.BranchId,
            type,
            request.PeriodStart,
            request.PeriodEnd,
            request.Notes);

        foreach (CreateStockCountSessionItemInput item in request.Items)
        {
            session.AddItem(StockCountItem.Create(
                session.Id,
                item.StockItemId,
                item.VariantId,
                item.SystemQuantity,
                item.UnitCost));
        }

        stockCountRepository.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(session);
    }

    internal static StockCountSessionResponse MapToResponse(StockCountSession session) =>
        new(session.Id.Value,
            session.BranchId,
            session.Type.ToString(),
            session.Status.ToString(),
            session.PeriodStart,
            session.PeriodEnd,
            session.Notes,
            session.CreatedAt,
            session.CompletedAt,
            session.TotalItems,
            session.CountedItems,
            session.DiscrepancyCount,
            session.TotalSystemValue,
            session.TotalCountedValue,
            session.TotalTaxAmount,
            session.Items.Select(i => new StockCountItemResponse(
                i.Id.Value,
                i.StockItemId,
                i.VariantId,
                i.SystemQuantity,
                i.CountedQuantity,
                i.Difference,
                i.UnitCost,
                i.SystemValue,
                i.CountedValue,
                i.TaxAmount,
                i.HasDiscrepancy)).ToList());
}
