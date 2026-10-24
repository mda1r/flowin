using NexusPOS.Inventory.Domain.Enums;

namespace NexusPOS.Inventory.Domain.Entities;

public sealed class StockMaterial
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public Guid? CategoryId { get; private set; }
    public string StorageUnit { get; private set; } = string.Empty;
    public string ComponentUnit { get; private set; } = string.Empty;
    public decimal ConversionFactor { get; private set; }
    public CostMethod CostMethod { get; private set; }
    public decimal CurrentCost { get; private set; }
    public decimal CurrentQuantityInStorageUnits { get; private set; }
    public decimal? MinLevel { get; private set; }
    public decimal? MaxLevel { get; private set; }
    public decimal? ReorderLevel { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private StockMaterial() { }

    public static StockMaterial Create(
        Guid tenantId,
        string code,
        string nameAr,
        string? nameEn,
        Guid? categoryId,
        string storageUnit,
        string componentUnit,
        decimal conversionFactor,
        CostMethod costMethod,
        decimal initialCost = 0m,
        decimal initialQuantity = 0m,
        decimal? minLevel = null,
        decimal? maxLevel = null,
        decimal? reorderLevel = null)
    {
        return new StockMaterial
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code.Trim().ToUpperInvariant(),
            NameAr = nameAr.Trim(),
            NameEn = nameEn?.Trim(),
            CategoryId = categoryId,
            StorageUnit = storageUnit.Trim(),
            ComponentUnit = componentUnit.Trim(),
            ConversionFactor = conversionFactor,
            CostMethod = costMethod,
            CurrentCost = initialCost,
            CurrentQuantityInStorageUnits = initialQuantity >= 0 ? initialQuantity : 0m,
            MinLevel = minLevel,
            MaxLevel = maxLevel,
            ReorderLevel = reorderLevel,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void Update(
        string code,
        string nameAr,
        string? nameEn,
        Guid? categoryId,
        string storageUnit,
        string componentUnit,
        decimal conversionFactor,
        CostMethod costMethod,
        decimal? manualCost,
        decimal? manualQuantity,
        decimal? minLevel,
        decimal? maxLevel,
        decimal? reorderLevel)
    {
        Code = code.Trim().ToUpperInvariant();
        NameAr = nameAr.Trim();
        NameEn = nameEn?.Trim();
        CategoryId = categoryId;
        StorageUnit = storageUnit.Trim();
        ComponentUnit = componentUnit.Trim();
        ConversionFactor = conversionFactor;
        CostMethod = costMethod;
        if (manualCost.HasValue)
        {
            CurrentCost = manualCost.Value;
        }
        if (manualQuantity.HasValue && manualQuantity.Value >= 0)
        {
            CurrentQuantityInStorageUnits = manualQuantity.Value;
        }
        MinLevel = minLevel;
        MaxLevel = maxLevel;
        ReorderLevel = reorderLevel;
        UpdatedAt = DateTime.UtcNow;
    }

    // CurrentCost is per storage unit; unitCost is the purchase price per storage unit.
    public void Receive(decimal quantity, decimal unitCost)
    {
        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity), "Received quantity must be positive.");
        }
        if (unitCost < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(unitCost), "Unit cost cannot be negative.");
        }

        decimal onHand = Math.Max(CurrentQuantityInStorageUnits, 0m);
        CurrentCost = CostMethod == CostMethod.WeightedAverage && onHand > 0
            ? Math.Round(((onHand * CurrentCost) + (quantity * unitCost)) / (onHand + quantity), 4)
            : unitCost;
        CurrentQuantityInStorageUnits = onHand + quantity;
        UpdatedAt = DateTime.UtcNow;
    }

    public decimal CostPerComponentUnit => ConversionFactor > 0 ? Math.Round(CurrentCost / ConversionFactor, 6) : 0m;

    public void UpdateCost(decimal newCost)
    {
        CurrentCost = newCost;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AdjustQuantity(decimal delta)
    {
        CurrentQuantityInStorageUnits += delta;
        if (CurrentQuantityInStorageUnits < 0)
        {
            CurrentQuantityInStorageUnits = 0;
        }
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public bool IsLowStock => ReorderLevel.HasValue && CurrentQuantityInStorageUnits <= ReorderLevel.Value;
}
