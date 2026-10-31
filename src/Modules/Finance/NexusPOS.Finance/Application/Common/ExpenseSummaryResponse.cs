using NexusPOS.Finance.Domain.Enums;

namespace NexusPOS.Finance.Application.Common;

public sealed record ExpenseSummaryResponse(
    DateOnly DateFrom,
    DateOnly DateTo,
    ExpenseStatusTotalResponse Approved,
    ExpenseStatusTotalResponse Pending,
    ExpenseStatusTotalResponse Voided,
    IReadOnlyList<ExpenseCategoryTotalResponse> ByCategory,
    IReadOnlyList<ExpenseGroupResponse> Groups);

public sealed record ExpenseStatusTotalResponse(ExpenseStatus Status, int Count, decimal Total);

public sealed record ExpenseCategoryTotalResponse(ExpenseCategory Category, int Count, decimal Total);

/// <summary>One category/status cell, so the client can count rows for any filter it shows.</summary>
public sealed record ExpenseGroupResponse(ExpenseCategory Category, ExpenseStatus Status, int Count, decimal Total);
