namespace NexusPOS.SharedKernel.Application.Services;

// Lets the till price a sale's cost from the drink's recipe without referencing the Inventory module.
public interface IRecipeCostDirectory
{
    // Net cost of one unit for each variant id that has a recipe in the tenant; variants without one are left out.
    Task<IReadOnlyDictionary<Guid, decimal>> GetCostsAsync(
        Guid tenantId, IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default);
}
