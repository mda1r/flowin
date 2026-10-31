using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Moq;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;

namespace NexusPOS.Inventory.UnitTests.Persistence;

public sealed class StockCountSessionModelTests
{
    private static InventoryDbContext NewContext() =>
        new(
            new DbContextOptionsBuilder<InventoryDbContext>()
                .UseNpgsql("Host=localhost;Database=model_only")
                .Options,
            Mock.Of<IPublisher>());

    [Fact]
    public void Session_UsesXminAsConcurrencyToken()
    {
        using InventoryDbContext context = NewContext();

        IProperty token = context.Model.FindEntityType(typeof(StockCountSession))!.FindProperty("xmin")!;

        token.IsConcurrencyToken.Should().BeTrue();
        token.GetColumnName().Should().Be("xmin");
    }

    [Fact]
    public void CreateScript_DoesNotCreateTheXminSystemColumn()
    {
        using InventoryDbContext context = NewContext();

        string script = context.Database.GenerateCreateScript();

        script.Should().Contain("stock_count_sessions");
        script.Should().NotContain("xmin");
    }
}
