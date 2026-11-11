using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Finance.Application.Commands.ApproveExpense;
using NexusPOS.Finance.Application.Commands.CreateExpense;
using NexusPOS.Finance.Application.Commands.UpdateExpense;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Infrastructure.Persistence;
using NexusPOS.Finance.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Finance.UnitTests.Application;

public sealed class ExpenseHandlerTests : IDisposable
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _userId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private readonly FinanceDbContext _db = new(
        new DbContextOptionsBuilder<FinanceDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
        Mock.Of<IPublisher>());

    public void Dispose() => _db.Dispose();

    private static ITenantContext Context(Guid? tenantId, Guid? userId) =>
        Mock.Of<ITenantContext>(c => c.TenantId == tenantId && c.UserId == userId);

    private Expense Seed(Guid branchId, ExpenseCategory category, decimal amount, DateOnly date)
    {
        Expense expense = Expense.Create(_tenantId, branchId, category, amount, "SAR", "seed", date).Value;
        _db.Expenses.Add(expense);
        _db.SaveChanges();
        return expense;
    }

    [Fact]
    public async Task CreateExpense_TakesTenantFromToken()
    {
        CreateExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, _userId));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new CreateExpenseCommand(_branchId, ExpenseCategory.Wages, 3000m, "Wages October", new DateOnly(2026, 10, 28)),
            CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TenantId.Should().Be(_tenantId);
        (await _db.Expenses.SingleAsync()).TenantId.Should().Be(_tenantId);
    }

    [Fact]
    public async Task CreateExpense_WithoutTenant_IsRejected()
    {
        CreateExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(null, _userId));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new CreateExpenseCommand(_branchId, ExpenseCategory.Rent, 100m, "x", new DateOnly(2026, 10, 1)),
            CancellationToken.None);

        result.FirstError.Should().Be(FinanceErrors.NoTenant);
        (await _db.Expenses.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task CreateExpense_ByDefault_WaitsForApproval_InShopCurrency()
    {
        CreateExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, _userId));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new CreateExpenseCommand(_branchId, ExpenseCategory.GovernmentFees, 450m, "Iqama renewal", new DateOnly(2026, 10, 5)),
            CancellationToken.None);

        result.Value.Status.Should().Be(ExpenseStatus.Pending);
        result.Value.ApprovedBy.Should().BeNull();
        result.Value.Currency.Should().Be("SAR");
        result.Value.Category.Should().Be(ExpenseCategory.GovernmentFees);
    }

    [Fact]
    public async Task CreateExpense_ApproveNow_IsApprovedBySignedInUser()
    {
        CreateExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, _userId));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new CreateExpenseCommand(_branchId, ExpenseCategory.Rent, 5000m, "Rent", new DateOnly(2026, 10, 1), ApproveNow: true),
            CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Status.Should().Be(ExpenseStatus.Approved);
        result.Value.ApprovedBy.Should().Be(_userId);
        (await _db.Expenses.SingleAsync()).Status.Should().Be(ExpenseStatus.Approved);
    }

    [Fact]
    public async Task CreateExpense_ApproveNow_WithoutUser_IsRejected()
    {
        CreateExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, null));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new CreateExpenseCommand(_branchId, ExpenseCategory.Rent, 5000m, "Rent", new DateOnly(2026, 10, 1), ApproveNow: true),
            CancellationToken.None);

        result.FirstError.Should().Be(FinanceErrors.NoUser);
        (await _db.Expenses.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task UpdateExpense_Pending_ChangesEveryField()
    {
        Expense expense = Seed(_branchId, ExpenseCategory.Other, 100m, new DateOnly(2026, 10, 1));
        UpdateExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, _userId));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new UpdateExpenseCommand(expense.Id.Value, _branchId, ExpenseCategory.BankFees, 87.5m, " Mada fees ", new DateOnly(2026, 10, 9), "October"),
            CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Category.Should().Be(ExpenseCategory.BankFees);
        result.Value.Amount.Should().Be(87.5m);
        result.Value.Description.Should().Be("Mada fees");
        result.Value.ExpenseDate.Should().Be(new DateOnly(2026, 10, 9));
        result.Value.Notes.Should().Be("October");
        result.Value.Status.Should().Be(ExpenseStatus.Pending);
    }

    [Theory]
    [InlineData(ExpenseStatus.Approved)]
    [InlineData(ExpenseStatus.Voided)]
    public async Task UpdateExpense_NotPending_IsRefusedAndUnchanged(ExpenseStatus status)
    {
        Expense expense = Seed(_branchId, ExpenseCategory.Rent, 5000m, new DateOnly(2026, 10, 1));
        if (status == ExpenseStatus.Approved)
        {
            expense.Approve(_userId);
        }
        else
        {
            expense.Void("duplicate");
        }

        await _db.SaveChangesAsync();
        UpdateExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, _userId));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new UpdateExpenseCommand(expense.Id.Value, _branchId, ExpenseCategory.Rent, 1m, "changed", new DateOnly(2026, 10, 2)),
            CancellationToken.None);

        result.FirstError.Should().Be(FinanceErrors.ExpenseNotPending);
        (await _db.Expenses.SingleAsync()).Amount.Should().Be(5000m);
    }

    [Fact]
    public async Task UpdateExpense_OtherBranchOrTenant_LooksMissing()
    {
        Expense expense = Seed(_branchId, ExpenseCategory.Rent, 5000m, new DateOnly(2026, 10, 1));
        UpdateExpenseCommand command = new(expense.Id.Value, Guid.NewGuid(), ExpenseCategory.Rent, 1m, "x", new DateOnly(2026, 10, 2));

        ErrorOr<ExpenseResponse> otherBranch = await new UpdateExpenseCommandHandler(new ExpenseRepository(_db), _db, Context(_tenantId, _userId))
            .Handle(command, CancellationToken.None);
        ErrorOr<ExpenseResponse> otherTenant = await new UpdateExpenseCommandHandler(new ExpenseRepository(_db), _db, Context(Guid.NewGuid(), _userId))
            .Handle(command with { BranchId = _branchId }, CancellationToken.None);

        otherBranch.FirstError.Should().Be(FinanceErrors.ExpenseNotFound);
        otherTenant.FirstError.Should().Be(FinanceErrors.ExpenseNotFound);
        (await _db.Expenses.SingleAsync()).Amount.Should().Be(5000m);
    }

    [Fact]
    public async Task ApproveExpense_RecordsSignedInUserAsApprover()
    {
        Expense expense = Seed(_branchId, ExpenseCategory.Rent, 5000m, new DateOnly(2026, 10, 1));
        ApproveExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, _userId));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new ApproveExpenseCommand(expense.Id.Value, _branchId), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Status.Should().Be(ExpenseStatus.Approved);
        result.Value.ApprovedBy.Should().Be(_userId);
    }

    [Fact]
    public async Task ApproveExpense_WithoutUser_IsRejected()
    {
        Expense expense = Seed(_branchId, ExpenseCategory.Rent, 5000m, new DateOnly(2026, 10, 1));
        ApproveExpenseCommandHandler handler = new(new ExpenseRepository(_db), _db, Context(_tenantId, null));

        ErrorOr<ExpenseResponse> result = await handler.Handle(
            new ApproveExpenseCommand(expense.Id.Value, _branchId), CancellationToken.None);

        result.FirstError.Should().Be(FinanceErrors.NoUser);
        expense.Status.Should().Be(ExpenseStatus.Pending);
    }

    [Fact]
    public async Task SumByCategoryAndStatus_OnlyCountsBranchAndRange()
    {
        Seed(_branchId, ExpenseCategory.Wages, 3000m, new DateOnly(2026, 10, 1));
        Seed(_branchId, ExpenseCategory.Wages, 2000m, new DateOnly(2026, 10, 31));
        Seed(_branchId, ExpenseCategory.Rent, 5000m, new DateOnly(2026, 10, 15)).Approve(_userId);
        Seed(_branchId, ExpenseCategory.Wages, 9999m, new DateOnly(2026, 11, 1));
        Seed(Guid.NewGuid(), ExpenseCategory.Wages, 7777m, new DateOnly(2026, 10, 10));
        await _db.SaveChangesAsync();

        IReadOnlyList<ExpenseTotal> totals = await new ExpenseRepository(_db).SumByCategoryAndStatusAsync(
            _branchId, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31));

        totals.Should().BeEquivalentTo(
        [
            new ExpenseTotal(ExpenseCategory.Wages, ExpenseStatus.Pending, 2, 5000m),
            new ExpenseTotal(ExpenseCategory.Rent, ExpenseStatus.Approved, 1, 5000m),
        ]);
    }
}
