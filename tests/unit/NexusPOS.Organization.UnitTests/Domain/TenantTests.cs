using FluentAssertions;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.Events;

namespace NexusPOS.Organization.UnitTests.Domain;

public sealed class TenantTests
{
    [Fact]
    public void Create_WithValidParams_ReturnsTenantWithFreeplan()
    {
        Tenant tenant = Tenant.Create("Acme Corp", "acme", "admin@acme.com");

        tenant.Name.Should().Be("Acme Corp");
        tenant.Subdomain.Should().Be("acme");
        tenant.AdminEmail.Should().Be("admin@acme.com");
        tenant.Plan.Should().Be(SubscriptionPlan.Free);
        tenant.IsActive.Should().BeTrue();
        tenant.Currency.Should().Be("USD");
        tenant.TimeZone.Should().Be("UTC");
    }

    [Fact]
    public void Create_NormalizesSubdomainToLower()
    {
        Tenant tenant = Tenant.Create("My Biz", "MyBiz", "owner@mybiz.com");

        tenant.Subdomain.Should().Be("mybiz");
    }

    [Fact]
    public void Create_NormalizesAdminEmailToLower()
    {
        Tenant tenant = Tenant.Create("Biz", "biz", "OWNER@BIZ.COM");

        tenant.AdminEmail.Should().Be("owner@biz.com");
    }

    [Fact]
    public void Create_NormalizesCurrencyToUpper()
    {
        Tenant tenant = Tenant.Create("Biz", "biz", "owner@biz.com", "eur");

        tenant.Currency.Should().Be("EUR");
    }

    [Fact]
    public void Create_RaisesTenantCreatedDomainEvent()
    {
        Tenant tenant = Tenant.Create("Acme Corp", "acme", "admin@acme.com");

        tenant.DomainEvents.Should().ContainSingle(e => e is TenantCreatedDomainEvent);
        TenantCreatedDomainEvent evt = (TenantCreatedDomainEvent)tenant.DomainEvents[0];
        evt.Name.Should().Be("Acme Corp");
        evt.Subdomain.Should().Be("acme");
    }

    [Fact]
    public void Suspend_SetsIsActiveFalseAndRaisesEvent()
    {
        Tenant tenant = Tenant.Create("Acme", "acme", "admin@acme.com");
        tenant.ClearDomainEvents();

        tenant.Suspend();

        tenant.IsActive.Should().BeFalse();
        tenant.SuspendedAt.Should().NotBeNull();
        tenant.DomainEvents.Should().ContainSingle(e => e is TenantSuspendedDomainEvent);
    }

    [Fact]
    public void Reinstate_SetsIsActiveTrue()
    {
        Tenant tenant = Tenant.Create("Acme", "acme", "admin@acme.com");
        tenant.Suspend();
        tenant.ClearDomainEvents();

        tenant.Reinstate();

        tenant.IsActive.Should().BeTrue();
        tenant.SuspendedAt.Should().BeNull();
    }

    [Fact]
    public void Upgrade_ChangesSubscriptionPlan()
    {
        Tenant tenant = Tenant.Create("Acme", "acme", "admin@acme.com");

        tenant.Upgrade(SubscriptionPlan.Professional);

        tenant.Plan.Should().Be(SubscriptionPlan.Professional);
    }

    [Fact]
    public void UpdateProfile_UpdatesAllEditableFields()
    {
        Tenant tenant = Tenant.Create("Old Name", "acme", "admin@acme.com");

        tenant.UpdateProfile("New Name", "GBP", "Europe/London", "https://logo.png", "+441234567", "GB123");

        tenant.Name.Should().Be("New Name");
        tenant.Currency.Should().Be("GBP");
        tenant.TimeZone.Should().Be("Europe/London");
        tenant.LogoUrl.Should().Be("https://logo.png");
        tenant.PhoneNumber.Should().Be("+441234567");
        tenant.TaxId.Should().Be("GB123");
    }

    [Fact]
    public void Create_TrimsWhitespaceFromName()
    {
        Tenant tenant = Tenant.Create("  Acme Corp  ", "acme", "admin@acme.com");

        tenant.Name.Should().Be("Acme Corp");
    }

    [Fact]
    public void Tenant_HasNonEmptyId()
    {
        Tenant tenant = Tenant.Create("Acme", "acme", "admin@acme.com");

        tenant.Id.Value.Should().NotBeEmpty();
    }

    [Fact]
    public void Tenant_CreatedAtIsUtc()
    {
        Tenant tenant = Tenant.Create("Acme", "acme", "admin@acme.com");

        tenant.CreatedAt.Kind.Should().Be(DateTimeKind.Utc);
    }
}
