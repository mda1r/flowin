using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;

namespace NexusPOS.POS.UnitTests.Domain;

// The shift totals are summed by PostgreSQL; these make sure the queries translate instead of failing at run time.
public sealed class ShiftTotalsReaderTests
{
    private static PosDbContext Context() => new(
        new DbContextOptionsBuilder<PosDbContext>().UseNpgsql("Host=localhost;Database=unused").Options,
        Mock.Of<IPublisher>());

    [Fact]
    public void SalesByMethod_GroupsAndSumsInTheDatabase()
    {
        using PosDbContext db = Context();
        CashierShift shift = CashierShift.Open(Guid.NewGuid(), Guid.NewGuid(), "سارة", 0m);

        string sql = ShiftTotalsReader.SalesByMethod(db, shift).ToQueryString();

        sql.Should().Contain("GROUP BY").And.Contain("sum(").And.Contain("payment_method");
    }

    [Fact]
    public void CashRefunds_FiltersByBranchMethodAndTime()
    {
        using PosDbContext db = Context();
        CashierShift shift = CashierShift.Open(Guid.NewGuid(), Guid.NewGuid(), "سارة", 0m);

        string sql = ShiftTotalsReader.CashRefunds(db, shift).ToQueryString();

        sql.Should().Contain("refund_method").And.Contain("branch_id").And.Contain("created_at");
    }
}
