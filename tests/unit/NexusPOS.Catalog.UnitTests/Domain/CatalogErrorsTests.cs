using System.Reflection;
using ErrorOr;
using FluentAssertions;
using NexusPOS.Catalog.Domain;

namespace NexusPOS.Catalog.UnitTests.Domain;

// The web client translates errors by code, so every Catalog error must carry a stable, prefixed code.
public sealed class CatalogErrorsTests
{
    private static readonly Error[] _all =
    [
        .. typeof(CatalogErrors)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.FieldType == typeof(Error))
            .Select(f => (Error)f.GetValue(null)!),
    ];

    [Fact]
    public void AllCodes_AreCatalogPrefixed()
    {
        _all.Should().NotBeEmpty();
        _all.Should().OnlyContain(e => e.Code.StartsWith("Catalog.", StringComparison.Ordinal));
    }

    [Fact]
    public void AllCodes_AreUnique()
    {
        _all.Select(e => e.Code).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void VariantNotFound_UsesCatalogCode()
    {
        CatalogErrors.VariantNotFound.Code.Should().Be("Catalog.VariantNotFound");
        CatalogErrors.VariantNotFound.Type.Should().Be(ErrorType.NotFound);
    }
}
