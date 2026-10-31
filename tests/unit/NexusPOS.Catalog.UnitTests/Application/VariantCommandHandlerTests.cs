using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Catalog.Application.Commands.AddProductVariant;
using NexusPOS.Catalog.Application.Commands.CreateProduct;
using NexusPOS.Catalog.Application.Commands.SetVariantActive;
using NexusPOS.Catalog.Application.Commands.UpdateProduct;
using NexusPOS.Catalog.Application.Commands.UpdateVariant;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.Catalog.Infrastructure.Persistence.Repositories;

namespace NexusPOS.Catalog.UnitTests.Application;

public sealed class VariantCommandHandlerTests
{
    private readonly string _databaseName = Guid.NewGuid().ToString();

    // Each call gets a fresh context on the same in-memory store, like separate HTTP requests.
    private CatalogDbContext NewDb() =>
        new(new DbContextOptionsBuilder<CatalogDbContext>()
                .UseInMemoryDatabase(_databaseName)
                .Options,
            new Mock<IPublisher>().Object);

    private async Task<ErrorOr<ProductResponse>> TryCreateAsync(string sku, string? barcode = null, TaxClass taxClass = TaxClass.Standard)
    {
        await using CatalogDbContext db = NewDb();
        CreateProductCommandHandler handler = new(new ProductRepository(db), db);
        return await handler.Handle(
            new CreateProductCommand("Water", null, null, ProductType.Standard, taxClass, true,
                sku, "Default", 1m, 2m, "SAR", barcode),
            CancellationToken.None);
    }

    private async Task<ProductResponse> CreateAsync(string sku, string? barcode = null, TaxClass taxClass = TaxClass.Standard)
    {
        ErrorOr<ProductResponse> result = await TryCreateAsync(sku, barcode, taxClass);
        result.IsError.Should().BeFalse();
        return result.Value;
    }

    private async Task<ErrorOr<ProductVariantResponse>> AddVariantAsync(Guid productId, string sku, string? barcode = null)
    {
        await using CatalogDbContext db = NewDb();
        AddProductVariantCommandHandler handler = new(new ProductRepository(db), db);
        return await handler.Handle(
            new AddProductVariantCommand(productId, sku, "Large", 2m, 4m, "SAR", barcode),
            CancellationToken.None);
    }

    private async Task<ErrorOr<ProductVariantResponse>> UpdateVariantAsync(
        Guid productId, Guid variantId, string? barcode = null, string? sku = null, decimal salePrice = 3m)
    {
        await using CatalogDbContext db = NewDb();
        UpdateVariantCommandHandler handler = new(new ProductRepository(db), db);
        return await handler.Handle(
            new UpdateVariantCommand(productId, variantId, "Default", 1m, salePrice, "SAR", barcode, sku),
            CancellationToken.None);
    }

    private async Task<ErrorOr<ProductVariantResponse>> SetActiveAsync(Guid productId, Guid variantId, bool isActive)
    {
        await using CatalogDbContext db = NewDb();
        SetVariantActiveCommandHandler handler = new(new ProductRepository(db), db);
        return await handler.Handle(new SetVariantActiveCommand(productId, variantId, isActive), CancellationToken.None);
    }

    private async Task<ProductVariant> LoadVariantAsync(Guid variantId)
    {
        await using CatalogDbContext db = NewDb();
        VariantId id = new(variantId);
        return await db.ProductVariants.AsNoTracking().SingleAsync(v => v.Id == id);
    }

    [Fact]
    public async Task CreateProduct_WithBarcodeUsedByAnotherProduct_ReturnsConflict()
    {
        await CreateAsync("A1", "6281000000017");

        ErrorOr<ProductResponse> result = await TryCreateAsync("B1", " 6281000000017 ");

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.BarcodeAlreadyExists");
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
    }

    [Fact]
    public async Task CreateProduct_WithBarcodeMatchingAnotherSku_ReturnsConflict()
    {
        await CreateAsync("6281000000017");

        ErrorOr<ProductResponse> result = await TryCreateAsync("B1", "6281000000017");

        result.FirstError.Code.Should().Be("Catalog.BarcodeAlreadyExists");
    }

    [Fact]
    public async Task CreateProduct_WithBlankBarcode_Succeeds()
    {
        await CreateAsync("A1", "");

        ErrorOr<ProductResponse> result = await TryCreateAsync("B1", "");

        result.IsError.Should().BeFalse();
        result.Value.Variants[0].Barcode.Should().BeNull();
    }

    [Fact]
    public async Task AddVariant_PersistsNewVariant()
    {
        ProductResponse product = await CreateAsync("A1");

        ErrorOr<ProductVariantResponse> result = await AddVariantAsync(product.Id, "a1-l", "111");

        result.IsError.Should().BeFalse();
        result.Value.Sku.Should().Be("A1-L");
        ProductVariant stored = await LoadVariantAsync(result.Value.Id);
        stored.Barcode.Should().Be("111");
        stored.ProductId.Value.Should().Be(product.Id);
    }

    [Fact]
    public async Task AddVariant_WithSkuOfAnotherProduct_ReturnsConflict()
    {
        ProductResponse first = await CreateAsync("A1");
        await CreateAsync("B1");

        ErrorOr<ProductVariantResponse> result = await AddVariantAsync(first.Id, "B1");

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.SkuAlreadyExists");
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
    }

    [Fact]
    public async Task AddVariant_WithTakenBarcode_ReturnsConflict()
    {
        ProductResponse first = await CreateAsync("A1");
        await CreateAsync("B1", "999");

        ErrorOr<ProductVariantResponse> result = await AddVariantAsync(first.Id, "A2", "999");

        result.FirstError.Code.Should().Be("Catalog.BarcodeAlreadyExists");
    }

    [Fact]
    public async Task UpdateVariant_WithoutBarcode_KeepsStoredBarcode()
    {
        ProductResponse product = await CreateAsync("A1", "6281000000017");
        Guid variantId = product.Variants[0].Id;

        ErrorOr<ProductVariantResponse> result = await UpdateVariantAsync(product.Id, variantId, salePrice: 5m);

        result.IsError.Should().BeFalse();
        ProductVariant stored = await LoadVariantAsync(variantId);
        stored.Barcode.Should().Be("6281000000017");
        stored.SalePrice.Amount.Should().Be(5m);
        stored.Sku.Value.Should().Be("A1");
    }

    [Fact]
    public async Task UpdateVariant_WithEmptyBarcode_ClearsIt()
    {
        ProductResponse product = await CreateAsync("A1", "6281000000017");
        Guid variantId = product.Variants[0].Id;

        await UpdateVariantAsync(product.Id, variantId, barcode: "");

        (await LoadVariantAsync(variantId)).Barcode.Should().BeNull();
    }

    [Fact]
    public async Task UpdateVariant_KeepingOwnBarcode_Succeeds()
    {
        ProductResponse product = await CreateAsync("A1", "777");

        ErrorOr<ProductVariantResponse> result = await UpdateVariantAsync(product.Id, product.Variants[0].Id, barcode: "777");

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateVariant_WithBarcodeOfAnotherProduct_ReturnsConflict()
    {
        ProductResponse product = await CreateAsync("A1");
        await CreateAsync("B1", "777");

        ErrorOr<ProductVariantResponse> result = await UpdateVariantAsync(product.Id, product.Variants[0].Id, barcode: "777");

        result.FirstError.Code.Should().Be("Catalog.BarcodeAlreadyExists");
    }

    [Fact]
    public async Task UpdateVariant_WithNewSku_ChangesSku()
    {
        ProductResponse product = await CreateAsync("A1");
        Guid variantId = product.Variants[0].Id;

        ErrorOr<ProductVariantResponse> result = await UpdateVariantAsync(product.Id, variantId, sku: "water-500");

        result.IsError.Should().BeFalse();
        (await LoadVariantAsync(variantId)).Sku.Value.Should().Be("WATER-500");
    }

    [Fact]
    public async Task UpdateVariant_WithSkuOfAnotherVariant_ReturnsConflict()
    {
        ProductResponse product = await CreateAsync("A1");
        await CreateAsync("B1");

        ErrorOr<ProductVariantResponse> result = await UpdateVariantAsync(product.Id, product.Variants[0].Id, sku: "b1");

        result.FirstError.Code.Should().Be("Catalog.SkuAlreadyExists");
    }

    [Fact]
    public async Task UpdateVariant_WithSkuMatchingAnotherBarcode_ReturnsConflict()
    {
        await CreateAsync("A1", "6281000000017");
        ProductResponse product = await CreateAsync("B1");

        ErrorOr<ProductVariantResponse> result = await UpdateVariantAsync(product.Id, product.Variants[0].Id, sku: "6281000000017");

        result.FirstError.Code.Should().Be("Catalog.SkuAlreadyExists");
        (await LoadVariantAsync(product.Variants[0].Id)).Sku.Value.Should().Be("B1");
    }

    [Fact]
    public async Task CreateProduct_WithSkuMatchingAnotherBarcode_ReturnsConflict()
    {
        await CreateAsync("A1", "6281000000017");

        ErrorOr<ProductResponse> result = await TryCreateAsync("6281000000017");

        result.FirstError.Code.Should().Be("Catalog.SkuAlreadyExists");
    }

    [Fact]
    public async Task AddVariant_WithSkuMatchingAnotherBarcode_ReturnsConflict()
    {
        ProductResponse first = await CreateAsync("A1");
        await CreateAsync("B1", "999");

        ErrorOr<ProductVariantResponse> result = await AddVariantAsync(first.Id, "999");

        result.FirstError.Code.Should().Be("Catalog.SkuAlreadyExists");
    }

    [Fact]
    public async Task UpdateProduct_WithoutTaxClassOrImage_KeepsThem()
    {
        ProductResponse product = await CreateAsync("A1", taxClass: TaxClass.Exempt);
        await using (CatalogDbContext seed = NewDb())
        {
            Product entity = await seed.Products.SingleAsync();
            entity.Update(entity.Name, null, null, null, true, "https://cdn/water.jpg");
            await seed.SaveChangesAsync();
        }

        await using CatalogDbContext db = NewDb();
        UpdateProductCommandHandler handler = new(new ProductRepository(db), db);
        ErrorOr<ProductResponse> result = await handler.Handle(
            new UpdateProductCommand(product.Id, "Water 1L", null, null, null, true),
            CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TaxClass.Should().Be(TaxClass.Exempt);
        result.Value.ImageUrl.Should().Be("https://cdn/water.jpg");
    }

    [Fact]
    public async Task SetVariantActive_DeactivatesAndReactivates()
    {
        ProductResponse product = await CreateAsync("A1");
        ErrorOr<ProductVariantResponse> added = await AddVariantAsync(product.Id, "A2", "555");

        (await SetActiveAsync(product.Id, added.Value.Id, false)).Value.IsActive.Should().BeFalse();
        (await LoadVariantAsync(added.Value.Id)).IsActive.Should().BeFalse();

        (await SetActiveAsync(product.Id, added.Value.Id, true)).Value.IsActive.Should().BeTrue();
        (await LoadVariantAsync(added.Value.Id)).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task SetVariantActive_ReactivatingWithBarcodeNowTaken_ReturnsConflict()
    {
        ProductResponse product = await CreateAsync("A1");
        ErrorOr<ProductVariantResponse> added = await AddVariantAsync(product.Id, "A2", "555");
        await SetActiveAsync(product.Id, added.Value.Id, false);

        // While the variant is off its barcode is free, so another product may take it.
        await CreateAsync("B1", "555");

        ErrorOr<ProductVariantResponse> result = await SetActiveAsync(product.Id, added.Value.Id, true);

        result.FirstError.Code.Should().Be("Catalog.BarcodeAlreadyExists");
    }

    [Fact]
    public async Task SetVariantActive_ReactivatingWithSkuNowAnotherBarcode_ReturnsConflict()
    {
        ProductResponse product = await CreateAsync("A1");
        ErrorOr<ProductVariantResponse> added = await AddVariantAsync(product.Id, "6281000000024");
        await SetActiveAsync(product.Id, added.Value.Id, false);

        // While the variant is off its SKU is free as a barcode, so another product may take it.
        await CreateAsync("B1", "6281000000024");

        ErrorOr<ProductVariantResponse> result = await SetActiveAsync(product.Id, added.Value.Id, true);

        result.FirstError.Code.Should().Be("Catalog.SkuAlreadyExists");
        (await LoadVariantAsync(added.Value.Id)).IsActive.Should().BeFalse();
    }
}
