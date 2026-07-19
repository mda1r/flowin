using ErrorOr;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.Events;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Catalog.Domain.Entities;

public sealed class Product : AggregateRoot<ProductId>
{
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public CategoryId? CategoryId { get; private set; }
    public ProductType Type { get; private set; }
    public TaxClass TaxClass { get; private set; }
    public bool IsActive { get; private set; }
    public bool TrackInventory { get; private set; }
    public string? ImageUrl { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public List<ProductVariant> Variants { get; private set; } = [];

    private Product() { }

    public static Product Create(
        string name,
        string? description,
        CategoryId? categoryId,
        ProductType type,
        TaxClass taxClass,
        bool trackInventory)
    {
        Product product = new()
        {
            Id = new ProductId(Guid.NewGuid()),
            Name = name.Trim(),
            Description = description?.Trim(),
            CategoryId = categoryId,
            Type = type,
            TaxClass = taxClass,
            IsActive = true,
            TrackInventory = trackInventory,
            CreatedAt = DateTime.UtcNow,
        };

        product.RaiseDomainEvent(
            new ProductCreatedDomainEvent(product.Id.Value, product.Name, string.Empty));

        return product;
    }

    public ErrorOr<ProductVariant> AddVariant(
        Sku sku,
        string name,
        Money costPrice,
        Money salePrice,
        string? barcode = null,
        DateTime? expiryDate = null)
    {
        bool skuExists = Variants.Any(v => v.Sku.Value == sku.Value);
        if (skuExists)
        {
            return CatalogErrors.SkuAlreadyExists;
        }

        ProductVariant variant = ProductVariant.Create(Id, sku, name, costPrice, salePrice, barcode, expiryDate);
        Variants.Add(variant);

        RaiseDomainEvent(new VariantAddedDomainEvent(Id.Value, variant.Id.Value, sku.Value));

        return variant;
    }

    public ErrorOr<Success> UpdateVariantPricing(VariantId variantId, Money costPrice, Money salePrice)
    {
        ProductVariant? variant = Variants.FirstOrDefault(v => v.Id == variantId);
        if (variant is null)
        {
            return CatalogErrors.VariantNotFound;
        }

        variant.UpdatePricing(costPrice, salePrice);
        return Result.Success;
    }

    public void Update(
        string name,
        string? description,
        CategoryId? categoryId,
        TaxClass taxClass,
        bool trackInventory,
        string? imageUrl)
    {
        Name = name.Trim();
        Description = description?.Trim();
        CategoryId = categoryId;
        TaxClass = taxClass;
        TrackInventory = trackInventory;
        ImageUrl = imageUrl?.Trim();
    }

    public void Deactivate()
    {
        IsActive = false;
        foreach (ProductVariant variant in Variants)
        {
            variant.Deactivate();
        }

        RaiseDomainEvent(new ProductDeactivatedDomainEvent(Id.Value));
    }

    public void Activate() => IsActive = true;
}
