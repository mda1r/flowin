using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Catalog.Infrastructure.Persistence;

namespace NexusPOS.Catalog.UnitTests.Infrastructure;

// Live tenants get the modifier tables from the startup EnsureCreated pass, which runs the model's create
// script statement by statement and skips what already exists. The new tables must be self-contained there,
// and the existing products/product_variants tables must not change shape.
public sealed class ModifierSchemaTests
{
    private static string CreateScript()
    {
        using CatalogDbContext db = new(
            new DbContextOptionsBuilder<CatalogDbContext>()
                .UseNpgsql("Host=localhost;Database=unused")
                .Options,
            new Mock<IPublisher>().Object);
        return db.Database.GenerateCreateScript();
    }

    [Fact]
    public void TheCreateScript_BuildsTheThreeModifierTables()
    {
        string script = CreateScript();

        script.Should().Contain("CREATE TABLE modifier_groups");
        script.Should().Contain("CREATE TABLE modifier_options");
        script.Should().Contain("CREATE TABLE product_modifier_groups");
        script.Should().Contain("price_delta numeric(18,4)");
        script.Should().Contain("REFERENCES products (id) ON DELETE CASCADE");
        script.Should().Contain("REFERENCES modifier_groups (id) ON DELETE CASCADE");
    }

    [Fact]
    public void ExistingCatalogTables_GainNoColumnsOrIndexes()
    {
        string script = CreateScript();
        string products = Block(script, "CREATE TABLE products");
        string variants = Block(script, "CREATE TABLE product_variants");

        products.Should().NotContain("modifier");
        variants.Should().NotContain("modifier");
        script.Should().NotContain("ON products (modifier").And.NotContain("ON product_variants (modifier");
    }

    private static string Block(string script, string start)
    {
        int from = script.IndexOf(start, StringComparison.Ordinal);
        from.Should().BeGreaterThanOrEqualTo(0);
        int to = script.IndexOf(");", from, StringComparison.Ordinal);
        return script[from..to];
    }
}
