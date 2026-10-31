using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Moq;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.UnitTests.Infrastructure;

public sealed class RestaurantOrderConcurrencyTests
{
    private static RestaurantDbContext NewContext() =>
        new(new DbContextOptionsBuilder<RestaurantDbContext>().UseNpgsql("Host=localhost").Options, new Mock<IPublisher>().Object);

    [Fact]
    public void Orders_UsePostgresRowVersion_AsTheirConcurrencyToken()
    {
        using RestaurantDbContext db = NewContext();

        IProperty xmin = db.Model.FindEntityType(typeof(RestaurantOrder))!.FindProperty("xmin")!;

        xmin.IsConcurrencyToken.Should().BeTrue();
        xmin.GetColumnName().Should().Be("xmin");
    }

    [Fact]
    public void CreateScript_DoesNotCreateTheSystemColumn()
    {
        using RestaurantDbContext db = NewContext();

        db.Database.GenerateCreateScript().Should().NotContain("xmin");
    }
}
