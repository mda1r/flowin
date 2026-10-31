using ErrorOr;
using FluentAssertions;
using NexusPOS.CRM.Domain;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Events;

namespace NexusPOS.CRM.UnitTests.Domain;

public sealed class CustomerTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidArgs_CreatesActiveCustomerWithEvent()
    {
        Customer customer = Customer.Create(_tenantId, "Jane Doe", "jane@example.com", "+966500000001");

        customer.TenantId.Should().Be(_tenantId);
        customer.Name.Should().Be("Jane Doe");
        customer.Email.Should().Be("jane@example.com");
        customer.Phone.Should().Be("+966500000001");
        customer.LoyaltyPoints.Should().Be(0);
        customer.IsActive.Should().BeTrue();
        customer.DomainEvents.Should().ContainSingle(e => e is CustomerCreatedDomainEvent);
    }

    [Fact]
    public void Create_TrimsWhitespace()
    {
        Customer customer = Customer.Create(_tenantId, "  Jane  ", "  jane@example.com  ");

        customer.Name.Should().Be("Jane");
        customer.Email.Should().Be("jane@example.com");
    }

    [Fact]
    public void Create_WithNullOptionalFields_Succeeds()
    {
        Customer customer = Customer.Create(_tenantId, "Minimal");

        customer.Email.Should().BeNull();
        customer.Phone.Should().BeNull();
        customer.LoyaltyPoints.Should().Be(0);
    }

    [Theory]
    [InlineData("0551234567", "+966551234567")]
    [InlineData("  +966 55 123 4567 ", "+966551234567")]
    [InlineData("٠٥٥١٢٣٤٥٦٧", "+966551234567")]
    [InlineData("0112345678", "0112345678")]
    [InlineData("٠١١ ٢٣٤٥٦٧٨", "011 2345678")]
    [InlineData("   ", null)]
    public void Create_StoresThePhoneNormalised(string phone, string? expected)
    {
        Customer customer = Customer.Create(_tenantId, "Jane", phone: phone);

        customer.Phone.Should().Be(expected);
    }

    // ── UpdateProfile ─────────────────────────────────────────────────────────

    [Fact]
    public void UpdateProfile_ChangesFields()
    {
        Customer customer = Customer.Create(_tenantId, "Old Name");

        customer.UpdateProfile("New Name", "new@email.com", null, null, null, null);

        customer.Name.Should().Be("New Name");
        customer.Email.Should().Be("new@email.com");
        customer.Phone.Should().BeNull();
    }

    // ── AddLoyaltyPoints ──────────────────────────────────────────────────────

    [Fact]
    public void AddLoyaltyPoints_PositiveAmount_IncrementsPoints()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");

        ErrorOr<Success> result = customer.AddLoyaltyPoints(100);

        result.IsError.Should().BeFalse();
        customer.LoyaltyPoints.Should().Be(100);
    }

    [Fact]
    public void AddLoyaltyPoints_Multiple_AccumulatesCorrectly()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");

        customer.AddLoyaltyPoints(50);
        customer.AddLoyaltyPoints(75);

        customer.LoyaltyPoints.Should().Be(125);
    }

    [Fact]
    public void AddLoyaltyPoints_ZeroPoints_ReturnsError()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");

        ErrorOr<Success> result = customer.AddLoyaltyPoints(0);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(CrmErrors.InvalidLoyaltyPoints);
    }

    [Fact]
    public void AddLoyaltyPoints_NegativePoints_ReturnsError()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");

        ErrorOr<Success> result = customer.AddLoyaltyPoints(-10);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(CrmErrors.InvalidLoyaltyPoints);
    }

    // ── RedeemLoyaltyPoints ───────────────────────────────────────────────────

    [Fact]
    public void RedeemLoyaltyPoints_SufficientBalance_DecrementsPoints()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");
        customer.AddLoyaltyPoints(200);

        ErrorOr<Success> result = customer.RedeemLoyaltyPoints(50);

        result.IsError.Should().BeFalse();
        customer.LoyaltyPoints.Should().Be(150);
    }

    [Fact]
    public void RedeemLoyaltyPoints_ExactBalance_DecrementToZero()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");
        customer.AddLoyaltyPoints(100);

        customer.RedeemLoyaltyPoints(100);

        customer.LoyaltyPoints.Should().Be(0);
    }

    [Fact]
    public void RedeemLoyaltyPoints_InsufficientBalance_ReturnsError()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");
        customer.AddLoyaltyPoints(50);

        ErrorOr<Success> result = customer.RedeemLoyaltyPoints(100);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(CrmErrors.InsufficientLoyaltyPoints);
    }

    [Fact]
    public void RedeemLoyaltyPoints_ZeroPoints_ReturnsError()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");

        ErrorOr<Success> result = customer.RedeemLoyaltyPoints(0);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(CrmErrors.InvalidLoyaltyPoints);
    }

    [Fact]
    public void Create_WithBlankOptionalFields_StoresNull()
    {
        Customer customer = Customer.Create(_tenantId, "Walk-in", "", "  ", "", notes: " ");

        customer.Email.Should().BeNull();
        customer.Phone.Should().BeNull();
        customer.Address.Should().BeNull();
        customer.Notes.Should().BeNull();
    }

    [Fact]
    public void UpdateProfile_WithBlankEmail_ClearsIt()
    {
        Customer customer = Customer.Create(_tenantId, "Jane", "jane@example.com");

        customer.UpdateProfile("Jane", "   ", "0500000000", "", null, null);

        customer.Email.Should().BeNull();
        customer.Phone.Should().Be("+966500000000");
        customer.Address.Should().BeNull();
    }

    // ── TakeBackLoyaltyPoints ─────────────────────────────────────────────────

    [Fact]
    public void TakeBackLoyaltyPoints_WithinBalance_DeductsAll()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");
        customer.AddLoyaltyPoints(100);

        int taken = customer.TakeBackLoyaltyPoints(40);

        taken.Should().Be(40);
        customer.LoyaltyPoints.Should().Be(60);
    }

    [Fact]
    public void TakeBackLoyaltyPoints_MoreThanBalance_StopsAtZero()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");
        customer.AddLoyaltyPoints(30);

        int taken = customer.TakeBackLoyaltyPoints(100);

        taken.Should().Be(30);
        customer.LoyaltyPoints.Should().Be(0);
    }

    [Fact]
    public void TakeBackLoyaltyPoints_Negative_DoesNothing()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");
        customer.AddLoyaltyPoints(30);

        customer.TakeBackLoyaltyPoints(-5).Should().Be(0);
        customer.LoyaltyPoints.Should().Be(30);
    }

    // ── Deactivate ────────────────────────────────────────────────────────────

    [Fact]
    public void Deactivate_SetsIsActiveFalse()
    {
        Customer customer = Customer.Create(_tenantId, "Jane");

        customer.Deactivate();

        customer.IsActive.Should().BeFalse();
    }
}
