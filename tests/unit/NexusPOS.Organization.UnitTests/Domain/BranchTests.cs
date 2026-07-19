using FluentAssertions;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.Events;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.UnitTests.Domain;

public sealed class BranchTests
{
    private static readonly TenantId _someTenantId = new(Guid.NewGuid());

    [Fact]
    public void Create_WithValidParams_ReturnsActiveBranch()
    {
        Branch branch = Branch.Create(_someTenantId, "Main Store", BranchType.Retail);

        branch.Name.Should().Be("Main Store");
        branch.Type.Should().Be(BranchType.Retail);
        branch.TenantId.Should().Be(_someTenantId);
        branch.IsActive.Should().BeTrue();
        branch.IsMainBranch.Should().BeFalse();
    }

    [Fact]
    public void Create_WithIsMainBranch_SetsFlag()
    {
        Branch branch = Branch.Create(_someTenantId, "HQ", BranchType.Office, isMainBranch: true);

        branch.IsMainBranch.Should().BeTrue();
    }

    [Fact]
    public void Create_TrimsWhitespaceFromName()
    {
        Branch branch = Branch.Create(_someTenantId, "  Downtown  ", BranchType.Retail);

        branch.Name.Should().Be("Downtown");
    }

    [Fact]
    public void Create_RaisesBranchCreatedDomainEvent()
    {
        Branch branch = Branch.Create(_someTenantId, "Main Store", BranchType.Retail);

        branch.DomainEvents.Should().ContainSingle(e => e is BranchCreatedDomainEvent);
        BranchCreatedDomainEvent evt = (BranchCreatedDomainEvent)branch.DomainEvents[0];
        evt.TenantId.Should().Be(_someTenantId.Value);
        evt.Name.Should().Be("Main Store");
    }

    [Fact]
    public void Deactivate_SetsIsActiveFalseAndRaisesEvent()
    {
        Branch branch = Branch.Create(_someTenantId, "Store", BranchType.Retail);
        branch.ClearDomainEvents();

        branch.Deactivate();

        branch.IsActive.Should().BeFalse();
        branch.DomainEvents.Should().ContainSingle(e => e is BranchDeactivatedDomainEvent);
    }

    [Fact]
    public void Activate_SetsIsActiveTrue()
    {
        Branch branch = Branch.Create(_someTenantId, "Store", BranchType.Retail);
        branch.Deactivate();
        branch.ClearDomainEvents();

        branch.Activate();

        branch.IsActive.Should().BeTrue();
        branch.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void Update_ChangesNameAndType()
    {
        Branch branch = Branch.Create(_someTenantId, "Old Name", BranchType.Retail);

        branch.Update("New Name", BranchType.Restaurant, null, null, null);

        branch.Name.Should().Be("New Name");
        branch.Type.Should().Be(BranchType.Restaurant);
    }

    [Fact]
    public void Update_NormalizesEmailToLower()
    {
        Branch branch = Branch.Create(_someTenantId, "Store", BranchType.Retail);

        branch.Update("Store", BranchType.Retail, null, null, "STORE@EXAMPLE.COM");

        branch.Email.Should().Be("store@example.com");
    }

    [Fact]
    public void Branch_HasNonEmptyId()
    {
        Branch branch = Branch.Create(_someTenantId, "Store", BranchType.Retail);

        branch.Id.Value.Should().NotBeEmpty();
    }

    [Fact]
    public void Branch_CreatedAtIsUtc()
    {
        Branch branch = Branch.Create(_someTenantId, "Store", BranchType.Retail);

        branch.CreatedAt.Kind.Should().Be(DateTimeKind.Utc);
    }
}
