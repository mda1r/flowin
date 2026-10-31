using ErrorOr;
using FluentAssertions;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class ProductEditTests
{
    private static Money Sar(decimal amount) => Money.Create(amount, "SAR").Value;

    private static Product CreateProduct(TaxClass taxClass = TaxClass.ZeroRated) =>
        Product.Create("Milk", null, null, ProductType.Standard, taxClass, true);

    [Fact]
    public void Update_WithNullTaxClassAndImage_KeepsStoredValues()
    {
        Product product = CreateProduct();
        product.Update("Milk", null, null, TaxClass.ZeroRated, true, "https://cdn/milk.jpg");

        product.Update("Fresh Milk", null, null, null, true, null);

        product.Name.Should().Be("Fresh Milk");
        product.TaxClass.Should().Be(TaxClass.ZeroRated);
        product.ImageUrl.Should().Be("https://cdn/milk.jpg");
    }

    [Fact]
    public void Update_WithEmptyImageUrl_ClearsImage()
    {
        Product product = CreateProduct();
        product.Update("Milk", null, null, null, true, "https://cdn/milk.jpg");

        product.Update("Milk", null, null, TaxClass.Exempt, true, "  ");

        product.ImageUrl.Should().BeNull();
        product.TaxClass.Should().Be(TaxClass.Exempt);
    }

    [Fact]
    public void AddVariant_WithBlankBarcode_StoresNull()
    {
        Product product = CreateProduct();

        ProductVariant variant = product.AddVariant(Sku.Create("M1").Value, "1L", Sar(3), Sar(6), "   ").Value;

        variant.Barcode.Should().BeNull();
    }

    [Fact]
    public void SetVariantActive_DeactivatesOneVariant()
    {
        Product product = CreateProduct();
        product.AddVariant(Sku.Create("M1").Value, "1L", Sar(3), Sar(6));
        ProductVariant large = product.AddVariant(Sku.Create("M2").Value, "2L", Sar(5), Sar(10)).Value;

        ErrorOr<Success> result = product.SetVariantActive(large.Id, false);

        result.IsError.Should().BeFalse();
        large.IsActive.Should().BeFalse();
        product.Variants.Count(v => v.IsActive).Should().Be(1);
    }

    [Fact]
    public void SetVariantActive_LastActiveVariant_IsRejected()
    {
        Product product = CreateProduct();
        ProductVariant only = product.AddVariant(Sku.Create("M1").Value, "1L", Sar(3), Sar(6)).Value;

        ErrorOr<Success> result = product.SetVariantActive(only.Id, false);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.LastActiveVariant");
        only.IsActive.Should().BeTrue();
    }

    [Fact]
    public void SetVariantActive_OnInactiveProduct_CannotReactivate()
    {
        Product product = CreateProduct();
        ProductVariant variant = product.AddVariant(Sku.Create("M1").Value, "1L", Sar(3), Sar(6)).Value;
        product.Deactivate();

        ErrorOr<Success> result = product.SetVariantActive(variant.Id, true);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.ProductInactive");
    }

    [Fact]
    public void SetVariantActive_ReactivatesVariant()
    {
        Product product = CreateProduct();
        product.AddVariant(Sku.Create("M1").Value, "1L", Sar(3), Sar(6));
        ProductVariant large = product.AddVariant(Sku.Create("M2").Value, "2L", Sar(5), Sar(10)).Value;
        product.SetVariantActive(large.Id, false);

        ErrorOr<Success> result = product.SetVariantActive(large.Id, true);

        result.IsError.Should().BeFalse();
        large.IsActive.Should().BeTrue();
    }

    [Fact]
    public void SetVariantActive_UnknownVariant_ReturnsNotFound()
    {
        Product product = CreateProduct();

        ErrorOr<Success> result = product.SetVariantActive(new VariantId(Guid.NewGuid()), false);

        result.FirstError.Code.Should().Be("Catalog.VariantNotFound");
    }
}
