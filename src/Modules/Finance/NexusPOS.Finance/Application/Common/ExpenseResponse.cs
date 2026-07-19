using NexusPOS.Finance.Domain.Enums;

namespace NexusPOS.Finance.Application.Common;

public sealed record ExpenseResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    ExpenseCategory Category,
    decimal Amount,
    string Currency,
    string Description,
    DateOnly ExpenseDate,
    ExpenseStatus Status,
    Guid? ApprovedBy,
    string? VoidReason,
    string? Notes,
    DateTime CreatedAt);
