using ErrorOr;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.Events;
using NexusPOS.Finance.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Finance.Domain.Entities;

public sealed class Expense : AggregateRoot<ExpenseId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public ExpenseCategory Category { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DateOnly ExpenseDate { get; private set; }
    public ExpenseStatus Status { get; private set; }
    public Guid? ApprovedBy { get; private set; }
    public string? VoidReason { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Expense() { }

    public static ErrorOr<Expense> Create(
        Guid tenantId,
        Guid branchId,
        ExpenseCategory category,
        decimal amount,
        string currency,
        string description,
        DateOnly expenseDate,
        string? notes = null)
    {
        if (amount <= 0)
        {
            return FinanceErrors.InvalidAmount;
        }

        Expense expense = new()
        {
            Id = new ExpenseId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            Category = category,
            Amount = amount,
            Currency = currency.Trim().ToUpperInvariant(),
            Description = description.Trim(),
            ExpenseDate = expenseDate,
            Status = ExpenseStatus.Pending,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        expense.RaiseDomainEvent(new ExpenseCreatedDomainEvent(
            expense.Id.Value, tenantId, branchId, amount, expense.Currency));

        return expense;
    }

    public ErrorOr<Success> Approve(Guid approvedBy)
    {
        if (Status == ExpenseStatus.Voided)
        {
            return FinanceErrors.ExpenseAlreadyVoided;
        }

        if (Status == ExpenseStatus.Approved)
        {
            return FinanceErrors.ExpenseAlreadyApproved;
        }

        Status = ExpenseStatus.Approved;
        ApprovedBy = approvedBy;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Void(string? reason = null)
    {
        if (Status == ExpenseStatus.Voided)
        {
            return FinanceErrors.ExpenseAlreadyVoided;
        }

        Status = ExpenseStatus.Voided;
        VoidReason = reason?.Trim();
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Update(
        ExpenseCategory category, decimal amount, string description, DateOnly expenseDate, string? notes)
    {
        if (Status != ExpenseStatus.Pending)
        {
            return FinanceErrors.ExpenseNotPending;
        }

        if (amount <= 0)
        {
            return FinanceErrors.InvalidAmount;
        }

        Category = category;
        Amount = amount;
        Description = description.Trim();
        ExpenseDate = expenseDate;
        Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }
}
