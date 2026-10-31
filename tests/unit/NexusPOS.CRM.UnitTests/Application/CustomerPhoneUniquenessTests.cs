using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.CRM.Application.Commands.CreateCustomer;
using NexusPOS.CRM.Application.Commands.UpdateCustomer;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.CRM.Infrastructure.Persistence.Repositories;

namespace NexusPOS.CRM.UnitTests.Application;

// One customer per phone in a store, whatever form the number was typed or stored in.
public sealed class CustomerPhoneUniquenessTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();

    [Theory]
    [InlineData("0551234567")]
    [InlineData("+966 55 123 4567")]
    [InlineData("٠٥٥١٢٣٤٥٦٧")]
    public async Task Create_WithAPhoneAlreadyTaken_IsAConflict(string typed)
    {
        await using CrmDbContext db = CreateDb();
        await SeedAsync(db, Customer.Create(_tenantId, "Sara", phone: "0551234567"));

        ErrorOr<CustomerResponse> result = await CreateAsync(db, _tenantId, "Sara again", typed);

        result.FirstError.Should().Be(CrmErrors.CustomerPhoneTaken);
        (await db.Customers.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Create_MatchesARowSavedBeforePhonesWereNormalised()
    {
        await using CrmDbContext db = CreateDb();
        Customer old = Customer.Create(_tenantId, "Old");
        await SeedAsync(db, old);
        db.Entry(old).Property(c => c.Phone).CurrentValue = "0551234567";
        await db.SaveChangesAsync();

        ErrorOr<CustomerResponse> result = await CreateAsync(db, _tenantId, "New", "+966551234567");

        result.FirstError.Should().Be(CrmErrors.CustomerPhoneTaken);
    }

    [Fact]
    public async Task Create_SamePhoneInAnotherStoreOrOnAnInactiveCustomer_Saves()
    {
        await using CrmDbContext db = CreateDb();
        Customer inactive = Customer.Create(_tenantId, "Gone", phone: "0551234567");
        inactive.Deactivate();
        await SeedAsync(db, inactive, Customer.Create(Guid.NewGuid(), "Elsewhere", phone: "0551234567"));

        ErrorOr<CustomerResponse> result = await CreateAsync(db, _tenantId, "Sara", "0551234567");

        result.IsError.Should().BeFalse();
        result.Value.Phone.Should().Be("+966551234567");
    }

    [Fact]
    public async Task Update_ToAnotherCustomersPhone_IsAConflict()
    {
        await using CrmDbContext db = CreateDb();
        Customer sara = Customer.Create(_tenantId, "Sara", phone: "0551234567");
        Customer omar = Customer.Create(_tenantId, "Omar", phone: "0559999999");
        await SeedAsync(db, sara, omar);

        ErrorOr<CustomerResponse> result = await UpdateAsync(db, omar, "٠٥٥١٢٣٤٥٦٧");

        result.FirstError.Should().Be(CrmErrors.CustomerPhoneTaken);
    }

    [Fact]
    public async Task Update_KeepingItsOwnPhone_Saves()
    {
        await using CrmDbContext db = CreateDb();
        Customer sara = Customer.Create(_tenantId, "Sara", phone: "0551234567");
        await SeedAsync(db, sara);

        ErrorOr<CustomerResponse> result = await UpdateAsync(db, sara, "+966551234567");

        result.IsError.Should().BeFalse();
        result.Value.Phone.Should().Be("+966551234567");
    }

    [Fact]
    public async Task Update_OfACustomerWhoAlreadySharedAPhone_StillSaves()
    {
        // Two rows from before the rule: renaming one must not be blocked by the other.
        await using CrmDbContext db = CreateDb();
        Customer first = Customer.Create(_tenantId, "First", phone: "0551234567");
        Customer second = Customer.Create(_tenantId, "Second", phone: "0551234567");
        await SeedAsync(db, first, second);

        ErrorOr<CustomerResponse> result = await UpdateAsync(db, second, "0551234567", name: "Second renamed");

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("Second renamed");
    }

    private static Task<ErrorOr<CustomerResponse>> CreateAsync(CrmDbContext db, Guid tenantId, string name, string phone) =>
        new CreateCustomerCommandHandler(new CustomerRepository(db), db)
            .Handle(new CreateCustomerCommand(tenantId, name, Phone: phone), CancellationToken.None);

    private static Task<ErrorOr<CustomerResponse>> UpdateAsync(CrmDbContext db, Customer customer, string phone, string? name = null) =>
        new UpdateCustomerCommandHandler(new CustomerRepository(db), db)
            .Handle(new UpdateCustomerCommand(customer.Id.Value, customer.TenantId, name ?? customer.Name, Phone: phone), CancellationToken.None);

    private static async Task SeedAsync(CrmDbContext db, params Customer[] customers)
    {
        db.Customers.AddRange(customers);
        await db.SaveChangesAsync();
    }

    private static CrmDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CrmDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options,
            new Mock<IPublisher>().Object);
}
