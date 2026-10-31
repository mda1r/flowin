namespace NexusPOS.SharedKernel.Application.Services;

// Lets other modules see a sale the cashier completed without referencing the POS module.
public interface IPosSaleDirectory
{
    // The lines of a completed sale in the branch, with unit prices including VAT;
    // null when no such sale was completed there.
    Task<IReadOnlyList<PosSaleLine>?> GetCompletedSaleLinesAsync(
        Guid branchId, Guid orderId, CancellationToken cancellationToken = default);
}

public sealed record PosSaleLine(Guid ItemId, string Name, decimal Quantity, decimal UnitPrice);
