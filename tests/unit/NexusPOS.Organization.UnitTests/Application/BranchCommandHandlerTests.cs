using ErrorOr;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Application.Commands.ActivateBranch;
using NexusPOS.Organization.Application.Commands.CreateBranch;
using NexusPOS.Organization.Application.Commands.DeactivateBranch;
using NexusPOS.Organization.Application.Commands.SetMainBranch;
using NexusPOS.Organization.Application.Commands.UpdateBranch;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.Organization.Infrastructure.Persistence.Repositories;

namespace NexusPOS.Organization.UnitTests.Application;

public sealed class BranchCommandHandlerTests
{
    private readonly DbContextOptions<OrganizationDbContext> _options = OrganizationDbFixture.NewOptions();
    private readonly TenantId _tenantId = new(Guid.NewGuid());

    private async Task<Branch> SeedAsync(string name, bool isMain = false, bool active = true, TenantId? tenantId = null)
    {
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        Branch branch = Branch.Create(tenantId ?? _tenantId, name, BranchType.Retail, isMain);
        if (!active)
        {
            branch.Deactivate();
        }

        db.Branches.Add(branch);
        await db.SaveChangesAsync();
        return branch;
    }

    private async Task<Branch> ReloadAsync(BranchId id)
    {
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        return await db.Branches.AsNoTracking().SingleAsync(b => b.Id == id);
    }

    // ── Deactivate ──────────────────────────────────────────────────

    [Fact]
    public async Task Deactivate_MainBranch_ReturnsConflictAndKeepsItActive()
    {
        Branch main = await SeedAsync("HQ", isMain: true);
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        DeactivateBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<Success> result = await handler.Handle(new DeactivateBranchCommand(main.Id.Value, _tenantId.Value), default);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(OrganizationErrors.CannotDeactivateMainBranch);
        (await ReloadAsync(main.Id)).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Deactivate_RegularBranch_SetsInactive()
    {
        Branch branch = await SeedAsync("Mall");
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        DeactivateBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<Success> result = await handler.Handle(new DeactivateBranchCommand(branch.Id.Value, _tenantId.Value), default);

        result.IsError.Should().BeFalse();
        (await ReloadAsync(branch.Id)).IsActive.Should().BeFalse();
    }

    // ── Activate ────────────────────────────────────────────────────

    [Fact]
    public async Task Activate_InactiveBranch_SetsActive()
    {
        Branch branch = await SeedAsync("Mall", active: false);
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        ActivateBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<Success> result = await handler.Handle(new ActivateBranchCommand(branch.Id.Value, _tenantId.Value), default);

        result.IsError.Should().BeFalse();
        (await ReloadAsync(branch.Id)).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Activate_BranchOfAnotherTenant_ReturnsNotFound()
    {
        Branch foreign = await SeedAsync("Other shop", active: false, tenantId: new TenantId(Guid.NewGuid()));
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        ActivateBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<Success> result = await handler.Handle(new ActivateBranchCommand(foreign.Id.Value, _tenantId.Value), default);

        result.FirstError.Should().Be(OrganizationErrors.BranchNotFound);
        (await ReloadAsync(foreign.Id)).IsActive.Should().BeFalse();
    }

    // ── Set main ────────────────────────────────────────────────────

    [Fact]
    public async Task SetMain_MovesFlagFromOldMainBranch()
    {
        Branch oldMain = await SeedAsync("HQ", isMain: true);
        Branch target = await SeedAsync("Mall");
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        SetMainBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<Success> result = await handler.Handle(new SetMainBranchCommand(target.Id.Value, _tenantId.Value), default);

        result.IsError.Should().BeFalse();
        (await ReloadAsync(target.Id)).IsMainBranch.Should().BeTrue();
        (await ReloadAsync(oldMain.Id)).IsMainBranch.Should().BeFalse();
    }

    [Fact]
    public async Task SetMain_InactiveBranch_ReturnsConflict()
    {
        Branch oldMain = await SeedAsync("HQ", isMain: true);
        Branch target = await SeedAsync("Mall", active: false);
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        SetMainBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<Success> result = await handler.Handle(new SetMainBranchCommand(target.Id.Value, _tenantId.Value), default);

        result.FirstError.Should().Be(OrganizationErrors.MainBranchMustBeActive);
        (await ReloadAsync(oldMain.Id)).IsMainBranch.Should().BeTrue();
    }

    [Fact]
    public async Task SetMain_BranchOfAnotherTenant_ReturnsNotFound()
    {
        Branch foreign = await SeedAsync("Other shop", tenantId: new TenantId(Guid.NewGuid()));
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        SetMainBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<Success> result = await handler.Handle(new SetMainBranchCommand(foreign.Id.Value, _tenantId.Value), default);

        result.FirstError.Should().Be(OrganizationErrors.BranchNotFound);
        (await ReloadAsync(foreign.Id)).IsMainBranch.Should().BeFalse();
    }

    // ── Update ──────────────────────────────────────────────────────

    [Fact]
    public async Task Update_ToNameOfAnotherBranch_ReturnsConflict()
    {
        await SeedAsync("HQ", isMain: true);
        Branch branch = await SeedAsync("Mall");
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        UpdateBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<BranchResponse> result = await handler.Handle(
            new UpdateBranchCommand(branch.Id.Value, _tenantId.Value, " HQ ", BranchType.Retail, null, null, null, null, null, null, null),
            default);

        result.FirstError.Should().Be(OrganizationErrors.BranchAlreadyExists);
        (await ReloadAsync(branch.Id)).Name.Should().Be("Mall");
    }

    [Fact]
    public async Task Update_KeepingOwnNameWithBlankContacts_SucceedsAndStoresNulls()
    {
        Branch branch = await SeedAsync("Mall");
        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        UpdateBranchCommandHandler handler = new(new BranchRepository(db), db);

        ErrorOr<BranchResponse> result = await handler.Handle(
            new UpdateBranchCommand(branch.Id.Value, _tenantId.Value, "Mall", BranchType.Restaurant, "", " ", null, "", null, "", null),
            default);

        result.IsError.Should().BeFalse();
        result.Value.Type.Should().Be(BranchType.Restaurant);
        result.Value.PhoneNumber.Should().BeNull();
        result.Value.Email.Should().BeNull();
        result.Value.City.Should().BeNull();
    }

    // ── Create ──────────────────────────────────────────────────────

    [Fact]
    public async Task Create_AsMainBranch_TakesFlagFromExistingMain()
    {
        Branch oldMain = await SeedAsync("HQ", isMain: true);
        await using (OrganizationDbContext seed = OrganizationDbFixture.Create(_options))
        {
            seed.Tenants.Add(Tenant.CreateWithId(_tenantId.Value, "Cafe", "cafe-test", "owner@cafe.test"));
            await seed.SaveChangesAsync();
        }

        await using OrganizationDbContext db = OrganizationDbFixture.Create(_options);
        CreateBranchCommandHandler handler = new(new TenantRepository(db), new BranchRepository(db), db);

        ErrorOr<BranchResponse> result = await handler.Handle(
            new CreateBranchCommand(_tenantId.Value, "New HQ", BranchType.Office, IsMainBranch: true), default);

        result.IsError.Should().BeFalse();
        result.Value.IsMainBranch.Should().BeTrue();
        (await ReloadAsync(oldMain.Id)).IsMainBranch.Should().BeFalse();
    }
}
