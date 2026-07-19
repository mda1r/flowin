using ErrorOr;
using FluentAssertions;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.Events;

namespace NexusPOS.Finance.UnitTests.Domain;

public sealed class ExpenseTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();
    private static readonly Guid _approverId = Guid.NewGuid();
    private static readonly DateOnly _today = DateOnly.FromDateTime(DateTime.UtcNow);

    private static ErrorOr<Expense> CreateValidExpense(decimal amount = 500m) =>
        Expense.Create(_tenantId, _branchId, ExpenseCategory.Rent, amount, "SAR", "Monthly rent", _today);

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidArgs_CreatesPendingExpenseWithEvent()
    {
        ErrorOr<Expense> result = CreateValidExpense();

        result.IsError.Should().BeFalse();
        result.Value.Status.Should().Be(ExpenseStatus.Pending);
        result.Value.Amount.Should().Be(500m);
        result.Value.Currency.Should().Be("SAR");
        result.Value.Category.Should().Be(ExpenseCategory.Rent);
        result.Value.DomainEvents.Should().ContainSingle(e => e is ExpenseCreatedDomainEvent);
    }

    [Fact]
    public void Create_NormalizesLowercaseCurrency()
    {
        ErrorOr<Expense> result = Expense.Create(_tenantId, _branchId, ExpenseCategory.Utilities, 100m, "sar", "Electric", _today);

        result.IsError.Should().BeFalse();
        result.Value.Currency.Should().Be("SAR");
    }

    [Fact]
    public void Create_ZeroAmount_ReturnsError()
    {
        ErrorOr<Expense> result = CreateValidExpense(0m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(FinanceErrors.InvalidAmount);
    }

    [Fact]
    public void Create_NegativeAmount_ReturnsError()
    {
        ErrorOr<Expense> result = CreateValidExpense(-100m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(FinanceErrors.InvalidAmount);
    }

    // ── Approve ───────────────────────────────────────────────────────────────

    [Fact]
    public void Approve_PendingExpense_TransitionsToApproved()
    {
        Expense expense = CreateValidExpense().Value;

        ErrorOr<Success> result = expense.Approve(_approverId);

        result.IsError.Should().BeFalse();
        expense.Status.Should().Be(ExpenseStatus.Approved);
        expense.ApprovedBy.Should().Be(_approverId);
    }

    [Fact]
    public void Approve_AlreadyApproved_ReturnsError()
    {
        Expense expense = CreateValidExpense().Value;
        expense.Approve(_approverId);

        ErrorOr<Success> result = expense.Approve(_approverId);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(FinanceErrors.ExpenseAlreadyApproved);
    }

    [Fact]
    public void Approve_VoidedExpense_ReturnsError()
    {
        Expense expense = CreateValidExpense().Value;
        expense.Void("Duplicate");

        ErrorOr<Success> result = expense.Approve(_approverId);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(FinanceErrors.ExpenseAlreadyVoided);
    }

    // ── Void ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Void_PendingExpense_TransitionsToVoided()
    {
        Expense expense = CreateValidExpense().Value;

        ErrorOr<Success> result = expense.Void("Entry error");

        result.IsError.Should().BeFalse();
        expense.Status.Should().Be(ExpenseStatus.Voided);
        expense.VoidReason.Should().Be("Entry error");
    }

    [Fact]
    public void Void_ApprovedExpense_TransitionsToVoided()
    {
        Expense expense = CreateValidExpense().Value;
        expense.Approve(_approverId);

        ErrorOr<Success> result = expense.Void("Cancelled");

        result.IsError.Should().BeFalse();
        expense.Status.Should().Be(ExpenseStatus.Voided);
    }

    [Fact]
    public void Void_AlreadyVoided_ReturnsError()
    {
        Expense expense = CreateValidExpense().Value;
        expense.Void("First void");

        ErrorOr<Success> result = expense.Void("Second void");

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(FinanceErrors.ExpenseAlreadyVoided);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [Fact]
    public void Update_PendingExpense_UpdatesFields()
    {
        Expense expense = CreateValidExpense().Value;

        ErrorOr<Success> result = expense.Update(ExpenseCategory.Utilities, 750m, "Electric bill", _today, null);

        result.IsError.Should().BeFalse();
        expense.Category.Should().Be(ExpenseCategory.Utilities);
        expense.Amount.Should().Be(750m);
        expense.Description.Should().Be("Electric bill");
    }

    [Fact]
    public void Update_ApprovedExpense_ReturnsError()
    {
        Expense expense = CreateValidExpense().Value;
        expense.Approve(_approverId);

        ErrorOr<Success> result = expense.Update(ExpenseCategory.Utilities, 750m, "Electric", _today, null);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(FinanceErrors.ExpenseNotPending);
    }
}
