using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Organization.Infrastructure.Persistence;

namespace NexusPOS.Organization.UnitTests.Application;

internal static class OrganizationDbFixture
{
    public static DbContextOptions<OrganizationDbContext> NewOptions() =>
        new DbContextOptionsBuilder<OrganizationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

    public static OrganizationDbContext Create(DbContextOptions<OrganizationDbContext> options) =>
        new(options, Mock.Of<IPublisher>());
}
