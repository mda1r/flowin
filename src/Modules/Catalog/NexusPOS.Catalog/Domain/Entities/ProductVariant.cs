using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Catalog.Domain.Entities;

public sealed class ProductVariant : Entity<VariantId>
{
    public ProductId ProductId { get; private set; } = null!;
    public Sku Sku { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public Money CostPrice { get; private set; } = null!;
    public Money SalePrice { get; private set; } = null!;
    public string? Barcode { get; private set; }
    public DateTime? ExpiryDate { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private ProductVariant() { }

    internal static ProductVariant Create(
        ProductId productId,
        Sku sku,
        string name,
        Money costPrice,
        Money salePrice,
        string? barcode = null,
        DateTime? expiryDate = null)
    {
        return new ProductVariant
        {
            Id = new VariantId(Guid.NewGuid()),
            ProductId = productId,
            Sku = sku,
            Name = name.Trim(),
            CostPrice = costPrice,
            SalePrice = salePrice,
            Barcode = barcode?.Trim(),
            ExpiryDate = expiryDate,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
    }

    internal void UpdatePricing(Money costPrice, Money salePrice)
    {
        CostPrice = costPrice;
        SalePrice = salePrice;
    }

    internal void UpdateDetails(string name, string? barcode)
    {
        Name = name.Trim();
        Barcode = barcode?.Trim();
    }

    internal void SetExpiryDate(DateTime? expiryDate) => ExpiryDate = expiryDate;

    internal void Deactivate() => IsActive = false;
}
