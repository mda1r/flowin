using ErrorOr;
using FluentAssertions;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class ModifierGroupTests
{
    private static readonly Guid _tenant = Guid.NewGuid();

    private static List<ModifierOptionDraft> Milks() =>
    [
        new(null, "حليب كامل", 0m, true, 0),
        new(null, "حليب شوفان", 2.6087m, true, 1),
        new(null, "حليب لوز", 2.6087m, true, 2),
    ];

    private static ErrorOr<ModifierGroup> Create(bool required, int min, int max, IReadOnlyList<ModifierOptionDraft>? options = null) =>
        ModifierGroup.Create(_tenant, "نوع الحليب", required, min, max, 0, options ?? Milks());

    [Theory]
    [InlineData(true, 1, 1)]
    [InlineData(false, 0, 1)]
    [InlineData(false, 0, 3)]
    [InlineData(true, 2, 3)]
    [InlineData(true, 3, 3)]
    public void ValidRules_AreAccepted(bool required, int min, int max)
    {
        ErrorOr<ModifierGroup> group = Create(required, min, max);

        group.IsError.Should().BeFalse();
        group.Value.IsActive.Should().BeTrue();
        group.Value.TenantId.Should().Be(_tenant);
        group.Value.Options.Should().HaveCount(3);
    }

    [Theory]
    [InlineData(false, -1, 1, "Catalog.ModifierMinNegative")]
    [InlineData(false, 0, 0, "Catalog.ModifierMaxTooSmall")]
    [InlineData(true, 3, 2, "Catalog.ModifierMinAboveMax")]
    [InlineData(true, 0, 1, "Catalog.ModifierRequiredNeedsMin")]
    [InlineData(false, 1, 2, "Catalog.ModifierMinNeedsRequired")]
    public void BrokenRules_AreRefused(bool required, int min, int max, string code)
    {
        ErrorOr<ModifierGroup> group = Create(required, min, max);

        group.IsError.Should().BeTrue();
        group.FirstError.Code.Should().Be(code);
        group.FirstError.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void ANegativePrice_IsRefused()
    {
        ErrorOr<ModifierGroup> group = Create(false, 0, 1, [new(null, "شراب", -1m)]);

        group.FirstError.Should().Be(CatalogErrors.ModifierPriceNegative);
    }

    [Fact]
    public void AFreeOption_IsAllowed()
    {
        ErrorOr<ModifierGroup> group = Create(false, 0, 1, [new(null, "بدون سكر", 0m)]);

        group.IsError.Should().BeFalse();
        group.Value.Options.Single().PriceDelta.Should().Be(0m);
    }

    [Fact]
    public void AGroupWithoutOptions_IsRefused() =>
        Create(false, 0, 1, []).FirstError.Should().Be(CatalogErrors.ModifierNoOptions);

    [Fact]
    public void ABlankName_IsRefused() =>
        ModifierGroup.Create(_tenant, "  ", false, 0, 1, 0, Milks()).FirstError.Should().Be(CatalogErrors.ModifierGroupNameRequired);

    [Fact]
    public void ABlankOptionName_IsRefused() =>
        Create(false, 0, 1, [new(null, " ", 1m)]).FirstError.Should().Be(CatalogErrors.ModifierOptionNameRequired);

    [Fact]
    public void TwoOptionsWithTheSameName_AreRefused() =>
        Create(false, 0, 2, [new(null, "شوت إضافي", 3m), new(null, " شوت إضافي ", 3m)])
            .FirstError.Should().Be(CatalogErrors.ModifierOptionDuplicate);

    [Fact]
    public void AMinimumTheActiveOptionsCannotCover_IsRefused()
    {
        List<ModifierOptionDraft> options = [new(null, "فانيلا", 2m, true), new(null, "كراميل", 2m, false)];

        Create(true, 2, 2, options).FirstError.Should().Be(CatalogErrors.ModifierMinAboveOptions);
    }

    [Fact]
    public void NamesAreTrimmed_AndNetPricesKeptToFourPlaces()
    {
        ErrorOr<ModifierGroup> group = ModifierGroup.Create(
            _tenant, "  الشراب  ", false, 0, 1, 0, [new(null, " كراميل ", 2m / 1.15m)]);

        group.Value.Name.Should().Be("الشراب");
        group.Value.Options.Single().Name.Should().Be("كراميل");
        group.Value.Options.Single().PriceDelta.Should().Be(1.7391m);
    }

    [Fact]
    public void Update_KeepsTheIdsOfOptionsStillPresent_RemovesTheRest_AndAddsNewOnes()
    {
        ModifierGroup group = Create(false, 0, 1).Value;
        ModifierOption whole = group.Options.Single(o => o.Name == "حليب كامل");
        ModifierOption oat = group.Options.Single(o => o.Name == "حليب شوفان");

        ErrorOr<Success> result = group.Update("الحليب", true, 1, 1, 2,
        [
            new(oat.Id.Value, "شوفان", 3m, true, 0),
            new(whole.Id.Value, "حليب كامل", 0m, false, 1),
            new(null, "حليب جوز الهند", 3m, true, 2),
        ]);

        result.IsError.Should().BeFalse();
        group.Name.Should().Be("الحليب");
        group.IsRequired.Should().BeTrue();
        group.MinSelect.Should().Be(1);
        group.SortOrder.Should().Be(2);
        group.Options.Should().HaveCount(3);
        group.Options.Should().NotContain(o => o.Name == "حليب لوز");

        ModifierOption keptOat = group.Options.Single(o => o.Id == oat.Id);
        keptOat.Should().BeSameAs(oat);
        keptOat.Name.Should().Be("شوفان");
        keptOat.PriceDelta.Should().Be(3m);
        group.Options.Single(o => o.Id == whole.Id).IsActive.Should().BeFalse();

        ModifierOption added = group.Options.Single(o => o.Name == "حليب جوز الهند");
        added.Id.Should().NotBe(oat.Id).And.NotBe(whole.Id);
        added.GroupId.Should().Be(group.Id);
    }

    [Fact]
    public void Update_WithAnUnknownOptionId_AddsItAsANewOption()
    {
        ModifierGroup group = Create(false, 0, 1).Value;
        Guid stranger = Guid.NewGuid();

        group.Update("نوع الحليب", false, 0, 1, 0, [new(stranger, "حليب صويا", 2m)]).IsError.Should().BeFalse();

        group.Options.Should().ContainSingle().Which.Id.Value.Should().NotBe(stranger);
    }

    [Fact]
    public void Update_ThatBreaksTheRules_ChangesNothing()
    {
        ModifierGroup group = Create(false, 0, 1).Value;
        List<Guid> before = [.. group.Options.Select(o => o.Id.Value)];

        ErrorOr<Success> result = group.Update("نوع الحليب", true, 0, 1, 0, [new(null, "حليب صويا", 2m)]);

        result.FirstError.Should().Be(CatalogErrors.ModifierRequiredNeedsMin);
        group.IsRequired.Should().BeFalse();
        group.Options.Select(o => o.Id.Value).Should().Equal(before);
    }

    [Fact]
    public void Deactivate_SwitchesTheGroupOff()
    {
        ModifierGroup group = Create(false, 0, 1).Value;

        group.Deactivate();

        group.IsActive.Should().BeFalse();
    }
}
