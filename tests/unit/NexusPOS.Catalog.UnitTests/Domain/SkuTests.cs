using ErrorOr;
using FluentAssertions;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class SkuTests
{
    [Fact]
    public void Create_WithValidValue_ReturnsNormalizedUppercase()
    {
        ErrorOr<Sku> result = Sku.Create("prod-001");

        result.IsError.Should().BeFalse();
        result.Value.Value.Should().Be("PROD-001");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithEmptyValue_ReturnsError(string? value)
    {
        ErrorOr<Sku> result = Sku.Create(value);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.Sku.Empty");
    }

    [Fact]
    public void Create_WithTooLongValue_ReturnsError()
    {
        string longSku = string.Create(65, 'A', static (span, c) => span.Fill(c));

        ErrorOr<Sku> result = Sku.Create(longSku);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.Sku.TooLong");
    }

    [Fact]
    public void Create_ExactlyAtMaxLength_Succeeds()
    {
        string maxSku = string.Create(64, 'A', static (span, c) => span.Fill(c));

        ErrorOr<Sku> result = Sku.Create(maxSku);

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public void Equality_SameValue_AreEqual()
    {
        Sku sku1 = Sku.Create("SKU-1").Value;
        Sku sku2 = Sku.Create("SKU-1").Value;

        sku1.Should().Be(sku2);
    }

    [Fact]
    public void Equality_CaseInsensitiveInput_AreEqual()
    {
        Sku sku1 = Sku.Create("sku-1").Value;
        Sku sku2 = Sku.Create("SKU-1").Value;

        sku1.Should().Be(sku2);
    }
}
