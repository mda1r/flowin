using FluentAssertions;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class PurchaseCostTests
{
    private static (Product Product, ProductVariant Variant) NewProduct(decimal cost = 5m)
    {
        Product product = Product.Create("قهوة مختصة", null, null, ProductType.Standard, TaxClass.Standard, true);
        ProductVariant variant = product
            .AddVariant(Sku.Create("COF-1").Value, "Standard", Money.Create(cost, "SAR").Value, Money.Create(15m, "SAR").Value)
            .Value;
        return (product, variant);
    }

    [Fact]
    public void ApplyPurchaseCost_SetsCostToPurchasePriceAndKeepsCurrency()
    {
        (Product product, ProductVariant variant) = NewProduct();

        product.ApplyPurchaseCost(variant.Id, 7.5m, DateTime.UtcNow).Should().BeTrue();

        variant.CostPrice.Amount.Should().Be(7.5m);
        variant.CostPrice.Currency.Should().Be("SAR");
        variant.SalePrice.Amount.Should().Be(15m);
    }

    [Fact]
    public void ApplyPurchaseCost_OlderReceiptNeverOverwritesNewerCost()
    {
        (Product product, ProductVariant variant) = NewProduct();
        DateTime newer = new(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc);
        product.ApplyPurchaseCost(variant.Id, 8m, newer);

        product.ApplyPurchaseCost(variant.Id, 6m, newer.AddDays(-3)).Should().BeFalse();

        variant.CostPrice.Amount.Should().Be(8m);
    }

    [Fact]
    public void ManualCostEdit_IsNotOverwrittenByRetryOfAnEarlierReceipt()
    {
        (Product product, ProductVariant variant) = NewProduct();
        DateTime received = DateTime.UtcNow.AddHours(-1);

        product.UpdateVariantPricing(variant.Id, Money.Create(9m, "SAR").Value, Money.Create(15m, "SAR").Value);
        product.ApplyPurchaseCost(variant.Id, 6m, received).Should().BeFalse();

        variant.CostPrice.Amount.Should().Be(9m);
    }

    [Fact]
    public void ApplyPurchaseCost_UnknownVariant_ChangesNothing()
    {
        (Product product, ProductVariant variant) = NewProduct();

        product.ApplyPurchaseCost(new VariantId(Guid.NewGuid()), 1m, DateTime.UtcNow).Should().BeFalse();

        variant.CostPrice.Amount.Should().Be(5m);
    }
}
