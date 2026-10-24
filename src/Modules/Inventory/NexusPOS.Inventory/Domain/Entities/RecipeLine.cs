namespace NexusPOS.Inventory.Domain.Entities;

// One ingredient of a sellable product variant's recipe; Quantity is in the material's component unit.
public sealed class RecipeLine
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid VariantId { get; private set; }
    public Guid MaterialId { get; private set; }
    public decimal Quantity { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private RecipeLine() { }

    public static RecipeLine Create(Guid tenantId, Guid variantId, Guid materialId, decimal quantity)
    {
        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity), "Recipe quantity must be positive.");
        }

        return new RecipeLine
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            VariantId = variantId,
            MaterialId = materialId,
            Quantity = quantity,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
