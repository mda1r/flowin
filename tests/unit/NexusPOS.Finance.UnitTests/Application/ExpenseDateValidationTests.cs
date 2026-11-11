using FluentAssertions;
using NexusPOS.Finance.Application.Commands.CreateExpense;
using NexusPOS.Finance.Domain.Enums;

namespace NexusPOS.Finance.UnitTests.Application;

public sealed class ExpenseDateValidationTests
{
    private static DateOnly SaudiToday => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));

    private static bool IsValid(DateOnly date) => new CreateExpenseCommandValidator()
        .Validate(new CreateExpenseCommand(Guid.NewGuid(), ExpenseCategory.Wages, 100m, "رواتب", date))
        .IsValid;

    [Fact]
    public void TodayAndPastDates_AreAccepted()
    {
        IsValid(SaudiToday).Should().BeTrue();
        IsValid(SaudiToday.AddMonths(-2)).Should().BeTrue();
    }

    [Fact]
    public void NextMonth_IsRefused()
    {
        IsValid(SaudiToday.AddDays(20)).Should().BeFalse();
    }
}
