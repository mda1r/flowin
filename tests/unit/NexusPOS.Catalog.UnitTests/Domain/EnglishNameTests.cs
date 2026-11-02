using FluentAssertions;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class EnglishNameTests
{
    private static Money Sar(decimal amount) => Money.Create(amount, "SAR").Value;

    [Theory]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData("  Latte ", "Latte")]
    public void Normalize_TrimsAndTreatsBlankAsNone(string? input, string? expected)
    {
        EnglishName.Normalize(input).Should().Be(expected);
    }

    [Fact]
    public void Normalize_CapsTheLength()
    {
        EnglishName.Normalize(new string('a', 400)).Should().HaveLength(EnglishName.MaxLength);
    }

    [Fact]
    public void Product_KeepsArabicNameAndAddsEnglish()
    {
        Product product = Product.Create("لاتيه", null, null, ProductType.Standard, TaxClass.Standard, false);

        product.SetNameEn(" Latte ");

        product.Name.Should().Be("لاتيه");
        product.NameEn.Should().Be("Latte");
    }

    [Fact]
    public void Variant_GetsItsOwnEnglishName()
    {
        Product product = Product.Create("لاتيه", null, null, ProductType.Standard, TaxClass.Standard, false);
        ProductVariant variant = product.AddVariant(Sku.Create("LAT-L").Value, "كبير", Sar(10), Sar(18)).Value;

        product.SetVariantNameEn(variant.Id, "Large").IsError.Should().BeFalse();

        variant.Name.Should().Be("كبير");
        variant.NameEn.Should().Be("Large");
    }

    [Fact]
    public void ModifierGroup_StoresEnglishNamesForGroupAndOptions()
    {
        ModifierGroup group = ModifierGroup.Create(
            Guid.NewGuid(), "الحليب", true, 1, 1, 0,
            [new ModifierOptionDraft(null, "حليب شوفان", 2m, NameEn: "Oat milk")],
            nameEn: "Milk").Value;

        group.NameEn.Should().Be("Milk");
        group.Options.Single().NameEn.Should().Be("Oat milk");

        group.Update("الحليب", true, 1, 1, 0, [new ModifierOptionDraft(group.Options[0].Id.Value, "حليب شوفان", 2m)], nameEn: null);

        group.NameEn.Should().BeNull();
        group.Options.Single().NameEn.Should().BeNull();
    }
}
