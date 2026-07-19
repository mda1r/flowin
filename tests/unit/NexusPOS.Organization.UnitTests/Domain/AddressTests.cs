using FluentAssertions;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.UnitTests.Domain;

public sealed class AddressTests
{
    [Fact]
    public void Create_NormalizesCountryToUpper()
    {
        Address address = Address.Create("123 Main St", "London", "England", "gb", "SW1A");

        address.Country.Should().Be("GB");
    }

    [Fact]
    public void Create_TrimsWhitespace()
    {
        Address address = Address.Create("  123 Main St  ", "  London  ", null, "  GB  ", null);

        address.Street.Should().Be("123 Main St");
        address.City.Should().Be("London");
        address.Country.Should().Be("GB");
    }

    [Fact]
    public void Create_WithNullableStateAndPostalCode_DoesNotThrow()
    {
        Address address = Address.Create("1 High St", "Manchester", null, "GB", null);

        address.State.Should().BeNull();
        address.PostalCode.Should().BeNull();
    }

    [Fact]
    public void Equality_SameValues_AreEqual()
    {
        Address a1 = Address.Create("1 High St", "City", null, "US", "12345");
        Address a2 = Address.Create("1 High St", "City", null, "US", "12345");

        a1.Should().Be(a2);
    }

    [Fact]
    public void Equality_DifferentCity_AreNotEqual()
    {
        Address a1 = Address.Create("1 High St", "City A", null, "US", "12345");
        Address a2 = Address.Create("1 High St", "City B", null, "US", "12345");

        a1.Should().NotBe(a2);
    }

    [Fact]
    public void ToString_ContainsCityAndCountry()
    {
        Address address = Address.Create("123 Main St", "Austin", "TX", "US", "78701");

        string str = address.ToString();

        str.Should().Contain("Austin");
        str.Should().Contain("US");
    }
}
