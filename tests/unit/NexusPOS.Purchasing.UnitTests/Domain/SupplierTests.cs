using FluentAssertions;
using NexusPOS.Purchasing.Domain.Entities;

namespace NexusPOS.Purchasing.UnitTests.Domain;

public sealed class SupplierTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();

    [Fact]
    public void Create_WithValidArgs_CreatesActiveSupplier()
    {
        Supplier supplier = Supplier.Create(_tenantId, "Acme Corp", "contact@acme.com", "+1234567890", "123 Main St");

        supplier.TenantId.Should().Be(_tenantId);
        supplier.Name.Should().Be("Acme Corp");
        supplier.ContactEmail.Should().Be("contact@acme.com");
        supplier.ContactPhone.Should().Be("+1234567890");
        supplier.Address.Should().Be("123 Main St");
        supplier.IsActive.Should().BeTrue();
        supplier.Id.Value.Should().NotBeEmpty();
    }

    [Fact]
    public void Create_TrimsWhitespace()
    {
        Supplier supplier = Supplier.Create(_tenantId, "  Acme Corp  ", "  contact@acme.com  ");

        supplier.Name.Should().Be("Acme Corp");
        supplier.ContactEmail.Should().Be("contact@acme.com");
    }

    [Fact]
    public void UpdateDetails_ChangesNameAndContact()
    {
        Supplier supplier = Supplier.Create(_tenantId, "Acme Corp");

        supplier.UpdateDetails("Acme Ltd", "new@acme.com", null, null);

        supplier.Name.Should().Be("Acme Ltd");
        supplier.ContactEmail.Should().Be("new@acme.com");
        supplier.ContactPhone.Should().BeNull();
    }

    [Fact]
    public void Deactivate_SetsIsActiveFalse()
    {
        Supplier supplier = Supplier.Create(_tenantId, "Acme Corp");

        supplier.Deactivate();

        supplier.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Create_WithNullOptionalFields_CreatesSupplierSuccessfully()
    {
        Supplier supplier = Supplier.Create(_tenantId, "Minimal Supplier");

        supplier.ContactEmail.Should().BeNull();
        supplier.ContactPhone.Should().BeNull();
        supplier.Address.Should().BeNull();
    }
}
