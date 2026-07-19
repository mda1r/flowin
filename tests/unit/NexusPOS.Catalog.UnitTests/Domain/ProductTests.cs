using ErrorOr;
using FluentAssertions;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.Events;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class ProductTests
{
    private static Product CreateProduct(string name = "Coffee Blend") =>
        Product.Create(name, null, null, ProductType.Standard, TaxClass.Standard, true);

    private static Sku ValidSku(string value = "SKU-001") => Sku.Create(value).Value;
    private static Money ValidCost() => Money.Create(5.00m, "USD").Value;
    private static Money ValidSalePrice() => Money.Create(12.00m, "USD").Value;

    [Fact]
    public void Create_WithValidParams_ReturnsActiveProduct()
    {
        Product product = CreateProduct();

        product.Name.Should().Be("Coffee Blend");
        product.IsActive.Should().BeTrue();
        product.TrackInventory.Should().BeTrue();
        product.CategoryId.Should().BeNull();
        product.Variants.Should().BeEmpty();
    }

    [Fact]
    public void Create_RaisesProductCreatedDomainEvent()
    {
        Product product = CreateProduct();

        product.DomainEvents.Should().ContainSingle(e => e is ProductCreatedDomainEvent);
    }

    [Fact]
    public void AddVariant_WithNewSku_AddsVariantAndRaisesEvent()
    {
        Product product = CreateProduct();
        product.ClearDomainEvents();

        ErrorOr<ProductVariant> result = product.AddVariant(ValidSku(), "Standard", ValidCost(), ValidSalePrice());

        result.IsError.Should().BeFalse();
        product.Variants.Should().HaveCount(1);
        product.DomainEvents.Should().ContainSingle(e => e is VariantAddedDomainEvent);
    }

    [Fact]
    public void AddVariant_WithDuplicateSku_ReturnsError()
    {
        Product product = CreateProduct();
        product.AddVariant(ValidSku(), "First", ValidCost(), ValidSalePrice());

        ErrorOr<ProductVariant> result = product.AddVariant(ValidSku(), "Duplicate", ValidCost(), ValidSalePrice());

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.SkuAlreadyExists");
    }

    [Fact]
    public void AddVariant_WithDifferentSkus_AllowsMultipleVariants()
    {
        Product product = CreateProduct();

        product.AddVariant(ValidSku("SKU-001"), "Small", ValidCost(), ValidSalePrice());
        product.AddVariant(ValidSku("SKU-002"), "Large", ValidCost(), ValidSalePrice());

        product.Variants.Should().HaveCount(2);
    }

    [Fact]
    public void Deactivate_SetsIsActiveFalseAndDeactivatesVariants()
    {
        Product product = CreateProduct();
        product.AddVariant(ValidSku(), "Standard", ValidCost(), ValidSalePrice());
        product.ClearDomainEvents();

        product.Deactivate();

        product.IsActive.Should().BeFalse();
        product.Variants.Should().AllSatisfy(v => v.IsActive.Should().BeFalse());
        product.DomainEvents.Should().ContainSingle(e => e is ProductDeactivatedDomainEvent);
    }

    [Fact]
    public void Activate_SetsIsActiveTrue()
    {
        Product product = CreateProduct();
        product.Deactivate();

        product.Activate();

        product.IsActive.Should().BeTrue();
    }

    [Fact]
    public void UpdateVariantPricing_ForUnknownVariant_ReturnsError()
    {
        Product product = CreateProduct();

        ErrorOr<Success> result = product.UpdateVariantPricing(
            new VariantId(Guid.NewGuid()), ValidCost(), ValidSalePrice());

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.VariantNotFound");
    }

    [Fact]
    public void Product_HasNonEmptyId()
    {
        Product product = CreateProduct();

        product.Id.Value.Should().NotBeEmpty();
    }

    [Fact]
    public void Product_CreatedAtIsUtc()
    {
        Product product = CreateProduct();

        product.CreatedAt.Kind.Should().Be(DateTimeKind.Utc);
    }
}
