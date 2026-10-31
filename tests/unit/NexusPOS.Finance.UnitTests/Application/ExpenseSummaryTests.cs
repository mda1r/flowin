using FluentAssertions;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Application.Queries.GetExpenseSummary;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.Repositories;

namespace NexusPOS.Finance.UnitTests.Application;

public sealed class ExpenseSummaryTests
{
    private static readonly DateOnly _from = new(2026, 10, 1);
    private static readonly DateOnly _to = new(2026, 10, 31);

    [Fact]
    public void Build_SplitsTotalsByStatus()
    {
        ExpenseSummaryResponse summary = GetExpenseSummaryQueryHandler.Build(_from, _to,
        [
            new ExpenseTotal(ExpenseCategory.Rent, ExpenseStatus.Approved, 1, 5000m),
            new ExpenseTotal(ExpenseCategory.Wages, ExpenseStatus.Approved, 3, 9000m),
            new ExpenseTotal(ExpenseCategory.Wages, ExpenseStatus.Pending, 1, 3000m),
            new ExpenseTotal(ExpenseCategory.Supplies, ExpenseStatus.Voided, 2, 400m),
        ]);

        summary.DateFrom.Should().Be(_from);
        summary.DateTo.Should().Be(_to);
        summary.Approved.Should().Be(new ExpenseStatusTotalResponse(ExpenseStatus.Approved, 4, 14000m));
        summary.Pending.Should().Be(new ExpenseStatusTotalResponse(ExpenseStatus.Pending, 1, 3000m));
        summary.Voided.Should().Be(new ExpenseStatusTotalResponse(ExpenseStatus.Voided, 2, 400m));
        summary.Groups.Should().HaveCount(4);
    }

    [Fact]
    public void Build_ByCategory_CountsApprovedOnly_LargestFirst()
    {
        ExpenseSummaryResponse summary = GetExpenseSummaryQueryHandler.Build(_from, _to,
        [
            new ExpenseTotal(ExpenseCategory.Rent, ExpenseStatus.Approved, 1, 5000m),
            new ExpenseTotal(ExpenseCategory.Wages, ExpenseStatus.Approved, 3, 9000m),
            new ExpenseTotal(ExpenseCategory.Wages, ExpenseStatus.Pending, 1, 3000m),
            new ExpenseTotal(ExpenseCategory.Equipment, ExpenseStatus.Voided, 1, 800m),
        ]);

        summary.ByCategory.Should().Equal(
            new ExpenseCategoryTotalResponse(ExpenseCategory.Wages, 3, 9000m),
            new ExpenseCategoryTotalResponse(ExpenseCategory.Rent, 1, 5000m));
    }

    [Fact]
    public void Build_NoExpenses_ReturnsZeros()
    {
        ExpenseSummaryResponse summary = GetExpenseSummaryQueryHandler.Build(_from, _to, []);

        summary.Approved.Total.Should().Be(0m);
        summary.Pending.Count.Should().Be(0);
        summary.ByCategory.Should().BeEmpty();
        summary.Groups.Should().BeEmpty();
    }

    [Fact]
    public void Validator_RejectsEndBeforeStart()
    {
        GetExpenseSummaryQueryValidator validator = new();

        validator.Validate(new GetExpenseSummaryQuery(Guid.NewGuid(), _to, _from)).IsValid.Should().BeFalse();
        validator.Validate(new GetExpenseSummaryQuery(Guid.NewGuid(), _from, _from)).IsValid.Should().BeTrue();
    }
}
