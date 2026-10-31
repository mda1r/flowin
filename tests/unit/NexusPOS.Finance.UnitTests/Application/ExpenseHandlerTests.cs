using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Finance.Application.Commands.ApproveExpense;
using NexusPOS.Finance.Application.Commands.CreateExpense;
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
            new CreateExpenseCommand(_branchId, ExpenseCategory.Wages, 3000m, "SAR", "Wages October", new DateOnly(2026, 10, 28)),
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
            new CreateExpenseCommand(_branchId, ExpenseCategory.Rent, 100m, "SAR", "x", new DateOnly(2026, 10, 1)),
            CancellationToken.None);

        result.FirstError.Should().Be(FinanceErrors.NoTenant);
        (await _db.Expenses.AnyAsync()).Should().BeFalse();
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
