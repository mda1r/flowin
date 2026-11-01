using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Catalog.Application.Commands.CreateModifierGroup;
using NexusPOS.Catalog.Application.Commands.DeactivateModifierGroup;
using NexusPOS.Catalog.Application.Commands.SetProductModifierGroups;
using NexusPOS.Catalog.Application.Commands.UpdateModifierGroup;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Queries.ListModifierGroups;
using NexusPOS.Catalog.Application.Queries.ListProducts;
using NexusPOS.Catalog.Application.Services;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.Catalog.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Catalog.UnitTests.Application;

// The real handlers on an in-memory store; each call gets a fresh context, like separate HTTP requests.
public sealed class ModifierGroupHandlerTests
{
    private readonly string _databaseName = Guid.NewGuid().ToString();
    private readonly Guid _tenant = Guid.NewGuid();
    private readonly Guid _otherTenant = Guid.NewGuid();

    private CatalogDbContext NewDb() =>
        new(new DbContextOptionsBuilder<CatalogDbContext>()
                .UseInMemoryDatabase(_databaseName)
                .Options,
            new Mock<IPublisher>().Object);

    private static ITenantContext As(Guid? tenantId)
    {
        Mock<ITenantContext> tenant = new();
        tenant.Setup(t => t.TenantId).Returns(tenantId);
        return tenant.Object;
    }

    private static List<ModifierOptionDraft> Milks() =>
    [
        new(null, "حليب كامل", 0m, true, 0),
        new(null, "حليب شوفان", 2.6087m, true, 1),
        new(null, "حليب لوز", 2.6087m, false, 2),
    ];

    private async Task<ErrorOr<ModifierGroupResponse>> CreateAsync(
        string name = "نوع الحليب", Guid? tenant = null, List<ModifierOptionDraft>? options = null)
    {
        await using CatalogDbContext db = NewDb();
        return await new CreateModifierGroupCommandHandler(db, As(tenant ?? _tenant)).Handle(
            new CreateModifierGroupCommand(name, true, 1, 1, 0, options ?? Milks()), CancellationToken.None);
    }

    private async Task<ErrorOr<ModifierGroupResponse>> UpdateAsync(
        Guid groupId, List<ModifierOptionDraft> options, Guid? tenant = null, string name = "نوع الحليب")
    {
        await using CatalogDbContext db = NewDb();
        return await new UpdateModifierGroupCommandHandler(db, As(tenant ?? _tenant)).Handle(
            new UpdateModifierGroupCommand(groupId, name, true, 1, 1, 0, options), CancellationToken.None);
    }

    private async Task<ErrorOr<Success>> AttachAsync(Guid productId, params Guid[] groupIds)
    {
        await using CatalogDbContext db = NewDb();
        return await new SetProductModifierGroupsCommandHandler(db, As(_tenant)).Handle(
            new SetProductModifierGroupsCommand(productId, groupIds), CancellationToken.None);
    }

    private async Task<Guid> SeedProductAsync(string name = "لاتيه")
    {
        await using CatalogDbContext db = NewDb();
        Product product = Product.Create(name, null, null, ProductType.Standard, TaxClass.Standard, false);
        product.AddVariant(Sku.Create(Guid.NewGuid().ToString("N")[..8]).Value, "وسط",
            Money.Create(2m, "SAR").Value, Money.Create(16m, "SAR").Value);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return product.Id.Value;
    }

    private async Task<IReadOnlyList<ProductResponse>> ListProductsAsync()
    {
        await using CatalogDbContext db = NewDb();
        ListProductsQueryHandler handler = new(new ProductRepository(db), new ProductModifierReader(db, As(_tenant)));
        return (await handler.Handle(new ListProductsQuery(), CancellationToken.None)).Value;
    }

    [Fact]
    public async Task Create_SavesTheGroupForTheTokenTenant()
    {
        ErrorOr<ModifierGroupResponse> created = await CreateAsync();

        created.IsError.Should().BeFalse();
        created.Value.Options.Select(o => o.Name).Should().Equal("حليب كامل", "حليب شوفان", "حليب لوز");
        await using CatalogDbContext db = NewDb();
        ModifierGroup stored = await db.ModifierGroups.Include(g => g.Options).SingleAsync();
        stored.TenantId.Should().Be(_tenant);
        stored.Options.Should().HaveCount(3);
    }

    [Fact]
    public async Task Create_WithoutATenant_IsRefused()
    {
        await using CatalogDbContext db = NewDb();
        ErrorOr<ModifierGroupResponse> result = await new CreateModifierGroupCommandHandler(db, As(null)).Handle(
            new CreateModifierGroupCommand("الحليب", false, 0, 1, 0, Milks()), CancellationToken.None);

        result.FirstError.Should().Be(CatalogErrors.NoTenant);
    }

    [Fact]
    public async Task Create_ADuplicateActiveName_Conflicts_ButAnotherTenantMayUseIt()
    {
        await CreateAsync();

        (await CreateAsync()).FirstError.Should().Be(CatalogErrors.ModifierGroupNameExists);
        (await CreateAsync(tenant: _otherTenant)).IsError.Should().BeFalse();
    }

    [Fact]
    public async Task Update_KeepsTheIdsOfOptionsStillPresent_AcrossRequests()
    {
        ModifierGroupResponse created = (await CreateAsync()).Value;
        ModifierOptionResponse whole = created.Options.Single(o => o.Name == "حليب كامل");
        ModifierOptionResponse oat = created.Options.Single(o => o.Name == "حليب شوفان");

        ErrorOr<ModifierGroupResponse> updated = await UpdateAsync(created.Id,
        [
            new(oat.Id, "حليب شوفان", 3.0435m, true, 0),
            new(whole.Id, "حليب كامل", 0m, true, 1),
            new(null, "حليب جوز الهند", 3.0435m, true, 2),
        ]);

        updated.IsError.Should().BeFalse();
        await using CatalogDbContext db = NewDb();
        List<ModifierOption> stored = await db.ModifierOptions.AsNoTracking().OrderBy(o => o.SortOrder).ToListAsync();
        stored.Select(o => o.Name).Should().Equal("حليب شوفان", "حليب كامل", "حليب جوز الهند");
        stored[0].Id.Value.Should().Be(oat.Id);
        stored[0].PriceDelta.Should().Be(3.0435m);
        stored[1].Id.Value.Should().Be(whole.Id);
        stored[2].Id.Value.Should().NotBe(oat.Id).And.NotBe(whole.Id);
        stored.Should().NotContain(o => o.Name == "حليب لوز");
    }

    [Fact]
    public async Task Update_AnotherTenantsGroup_IsNotFound()
    {
        ModifierGroupResponse created = (await CreateAsync()).Value;

        ErrorOr<ModifierGroupResponse> result = await UpdateAsync(created.Id, Milks(), _otherTenant);

        result.FirstError.Should().Be(CatalogErrors.ModifierGroupNotFound);
    }

    [Fact]
    public async Task Update_ThatBreaksTheRules_LeavesTheStoredOptionsAlone()
    {
        ModifierGroupResponse created = (await CreateAsync()).Value;

        ErrorOr<ModifierGroupResponse> result = await UpdateAsync(created.Id, [new(null, "حليب صويا", 2m, false)]);

        result.FirstError.Should().Be(CatalogErrors.ModifierMinAboveOptions);
        await using CatalogDbContext db = NewDb();
        (await db.ModifierOptions.CountAsync()).Should().Be(3);
    }

    [Fact]
    public async Task List_ShowsOnlyTheTenantsActiveGroups_WithTheirProducts()
    {
        ModifierGroupResponse milk = (await CreateAsync()).Value;
        ModifierGroupResponse old = (await CreateAsync("قديم")).Value;
        await CreateAsync("مجموعة غيرنا", _otherTenant);
        Guid latte = await SeedProductAsync();
        (await AttachAsync(latte, milk.Id)).IsError.Should().BeFalse();
        await using (CatalogDbContext db = NewDb())
        {
            await new DeactivateModifierGroupCommandHandler(db, As(_tenant))
                .Handle(new DeactivateModifierGroupCommand(old.Id), CancellationToken.None);
        }

        await using CatalogDbContext read = NewDb();
        IReadOnlyList<ModifierGroupResponse> active =
            (await new ListModifierGroupsQueryHandler(read, As(_tenant)).Handle(new ListModifierGroupsQuery(), CancellationToken.None)).Value;
        IReadOnlyList<ModifierGroupResponse> all =
            (await new ListModifierGroupsQueryHandler(read, As(_tenant)).Handle(new ListModifierGroupsQuery(true), CancellationToken.None)).Value;

        active.Should().ContainSingle().Which.ProductIds.Should().Equal(latte);
        all.Select(g => g.Name).Should().BeEquivalentTo(["نوع الحليب", "قديم"]);
    }

    [Fact]
    public async Task SetProductGroups_ReplacesTheLinks_InTheGivenOrder()
    {
        Guid milk = (await CreateAsync()).Value.Id;
        Guid shot = (await CreateAsync("شوت إضافي", options: [new(null, "شوت", 2.6087m)])).Value.Id;
        Guid syrup = (await CreateAsync("الشراب", options: [new(null, "فانيلا", 1.7391m)])).Value.Id;
        Guid latte = await SeedProductAsync();

        (await AttachAsync(latte, milk, shot)).IsError.Should().BeFalse();
        (await AttachAsync(latte, syrup, milk)).IsError.Should().BeFalse();

        await using CatalogDbContext db = NewDb();
        List<ProductModifierGroup> links = await db.ProductModifierGroups.AsNoTracking().OrderBy(l => l.SortOrder).ToListAsync();
        links.Select(l => l.GroupId.Value).Should().Equal(syrup, milk);
    }

    [Fact]
    public async Task SetProductGroups_WithAnEmptyList_DetachesEverything()
    {
        Guid milk = (await CreateAsync()).Value.Id;
        Guid latte = await SeedProductAsync();
        await AttachAsync(latte, milk);

        (await AttachAsync(latte)).IsError.Should().BeFalse();

        await using CatalogDbContext db = NewDb();
        (await db.ProductModifierGroups.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task SetProductGroups_RefusesAnotherTenantsGroup_AnInactiveGroup_AndAnUnknownProduct()
    {
        Guid foreign = (await CreateAsync("مجموعة غيرنا", _otherTenant)).Value.Id;
        Guid old = (await CreateAsync("قديم")).Value.Id;
        await using (CatalogDbContext db = NewDb())
        {
            await new DeactivateModifierGroupCommandHandler(db, As(_tenant))
                .Handle(new DeactivateModifierGroupCommand(old), CancellationToken.None);
        }

        Guid latte = await SeedProductAsync();

        (await AttachAsync(latte, foreign)).FirstError.Should().Be(CatalogErrors.ModifierGroupNotFound);
        (await AttachAsync(latte, old)).FirstError.Should().Be(CatalogErrors.ModifierGroupInactive);
        (await AttachAsync(Guid.NewGuid(), old)).FirstError.Should().Be(CatalogErrors.ProductNotFound);
    }

    [Fact]
    public async Task ProductList_CarriesActiveGroupsInOrder_WithActiveOptionsOnly()
    {
        Guid milk = (await CreateAsync()).Value.Id;
        Guid shot = (await CreateAsync("شوت إضافي", options: [new(null, "شوت", 2.6087m)])).Value.Id;
        Guid old = (await CreateAsync("قديم", options: [new(null, "قديم", 1m)])).Value.Id;
        Guid latte = await SeedProductAsync();
        Guid water = await SeedProductAsync("ماء");
        await AttachAsync(latte, shot, milk, old);
        await using (CatalogDbContext db = NewDb())
        {
            await new DeactivateModifierGroupCommandHandler(db, As(_tenant))
                .Handle(new DeactivateModifierGroupCommand(old), CancellationToken.None);
        }

        IReadOnlyList<ProductResponse> products = await ListProductsAsync();

        ProductResponse latteRow = products.Single(p => p.Id == latte);
        latteRow.ModifierGroups!.Select(g => g.Id).Should().Equal(shot, milk);
        ProductModifierGroupResponse milkGroup = latteRow.ModifierGroups!.Single(g => g.Id == milk);
        milkGroup.IsRequired.Should().BeTrue();
        milkGroup.Options.Select(o => o.Name).Should().Equal("حليب كامل", "حليب شوفان");
        products.Single(p => p.Id == water).ModifierGroups.Should().BeEmpty();
    }

    [Fact]
    public async Task OptionDirectory_ReturnsTheTenantsOptions_WithGroupRulesAndProducts()
    {
        ModifierGroupResponse milk = (await CreateAsync()).Value;
        ModifierGroupResponse foreign = (await CreateAsync("مجموعة غيرنا", _otherTenant)).Value;
        Guid latte = await SeedProductAsync();
        await AttachAsync(latte, milk.Id);
        Guid oat = milk.Options.Single(o => o.Name == "حليب شوفان").Id;
        Guid foreignOption = foreign.Options[0].Id;

        await using CatalogDbContext db = NewDb();
        ModifierLookup lookup = await new ModifierOptionDirectory(db).GetAsync(_tenant, [oat, foreignOption], [latte]);

        lookup.Options.Should().ContainSingle();
        ModifierOptionInfo info = lookup.Options[oat];
        info.GroupId.Should().Be(milk.Id);
        info.Name.Should().Be("حليب شوفان");
        info.PriceDelta.Should().Be(2.6087m);
        info.IsActive.Should().BeTrue();
        ModifierGroupRules rules = lookup.Groups.Should().ContainSingle().Subject.Value;
        rules.IsRequired.Should().BeTrue();
        rules.MinSelect.Should().Be(1);
        rules.MaxSelect.Should().Be(1);
        rules.ProductIds.Should().Equal(latte);
    }

    [Fact]
    public async Task OptionDirectory_ListsARequiredGroupOnTheProduct_EvenWithNothingPicked()
    {
        ModifierGroupResponse milk = (await CreateAsync()).Value;
        Guid latte = await SeedProductAsync();
        await AttachAsync(latte, milk.Id);

        await using CatalogDbContext db = NewDb();
        ModifierLookup lookup = await new ModifierOptionDirectory(db).GetAsync(_tenant, [], [latte]);

        lookup.Options.Should().BeEmpty();
        lookup.Groups.Should().ContainKey(milk.Id);
    }

    [Fact]
    public async Task VariantDirectory_MapsEachSizeToItsProduct()
    {
        Guid latte = await SeedProductAsync();
        Guid size;
        await using (CatalogDbContext read = NewDb())
        {
            size = (await read.ProductVariants.SingleAsync()).Id.Value;
        }

        await using CatalogDbContext db = NewDb();
        IReadOnlyDictionary<Guid, Guid> products = await new VariantPriceDirectory(db).GetProductIdsAsync([size, Guid.NewGuid()]);

        products.Should().Equal(new Dictionary<Guid, Guid> { [size] = latte });
    }
}
