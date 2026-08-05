using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Application.Common;

public sealed record ShiftResponse(
    Guid Id,
    Guid BranchId,
    Guid UserId,
    string CashierName,
    ShiftStatus Status,
    decimal OpeningCash,
    decimal? ClosingCash,
    decimal TotalSales,
    decimal TotalCashSales,
    decimal TotalCardSales,
    decimal TotalTax,
    int TotalOrders,
    decimal? ExpectedCash,
    decimal? CashVariance,
    decimal? ClosingCardCount,
    decimal? CardVariance,
    string? Notes,
    DateTime OpenedAt,
    DateTime? ClosedAt);
