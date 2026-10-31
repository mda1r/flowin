using ErrorOr;
using FluentAssertions;
using Moq;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Queries.GetProductByBarcode;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.UnitTests.Application;

public sealed class GetProductByBarcodeTests
{
    private readonly Mock<IProductRepository> _products = new();

    [Fact]
    public async Task AScannedCode_IsLookedUpExactly_WithoutSurroundingSpaces()
    {
        Product rice = Product.Create("أرز بسمتي", null, null, ProductType.Standard, TaxClass.Standard, true);
        rice.AddVariant(Sku.Create("RICE-5").Value, "5 كغ", Money.Create(30m, "SAR").Value, Money.Create(45m, "SAR").Value, "6281000000017");
        _products.Setup(r => r.FindByBarcodeAsync("6281000000017", It.IsAny<CancellationToken>())).ReturnsAsync(rice);

        ErrorOr<ProductResponse> result = await Handler().Handle(new GetProductByBarcodeQuery(" 6281000000017 "), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("أرز بسمتي");
        result.Value.Variants.Should().ContainSingle(v => v.Barcode == "6281000000017");
    }

    [Fact]
    public async Task AnUnknownCode_IsNotFound()
    {
        ErrorOr<ProductResponse> result = await Handler().Handle(new GetProductByBarcodeQuery("000"), CancellationToken.None);

        result.FirstError.Should().Be(CatalogErrors.ProductNotFound);
    }

    [Fact]
    public async Task ABlankCode_NeverReachesTheDatabase()
    {
        ErrorOr<ProductResponse> result = await Handler().Handle(new GetProductByBarcodeQuery("   "), CancellationToken.None);

        result.FirstError.Should().Be(CatalogErrors.ProductNotFound);
        _products.Verify(r => r.FindByBarcodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private GetProductByBarcodeQueryHandler Handler() => new(_products.Object);
}
