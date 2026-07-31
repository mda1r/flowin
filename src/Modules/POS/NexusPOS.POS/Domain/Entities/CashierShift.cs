using ErrorOr;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Domain.Entities;

public sealed class CashierShift : Entity<CashierShiftId>
{
    public Guid BranchId { get; private set; }
    public Guid UserId { get; private set; }
    public string CashierName { get; private set; } = string.Empty;
    public ShiftStatus Status { get; private set; }
    public decimal OpeningCash { get; private set; }
    public decimal? ClosingCash { get; private set; }
    public decimal TotalSales { get; private set; }
    public decimal TotalCashSales { get; private set; }
    public decimal TotalCardSales { get; private set; }
    public decimal TotalTax { get; private set; }
    public int TotalOrders { get; private set; }
    public decimal? ExpectedCash { get; private set; }
    public decimal? CashVariance { get; private set; }
    public string? Notes { get; private set; }
    public DateTime OpenedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    private CashierShift() { }

    public static CashierShift Open(Guid branchId, Guid userId, string cashierName, decimal openingCash)
    {
        return new CashierShift
        {
            Id = new CashierShiftId(Guid.NewGuid()),
            BranchId = branchId,
            UserId = userId,
            CashierName = cashierName,
            Status = ShiftStatus.Open,
            OpeningCash = openingCash,
            OpenedAt = DateTime.UtcNow,
        };
    }

    public ErrorOr<Success> Close(
        decimal closingCash,
        decimal totalSales,
        decimal totalCashSales,
        decimal totalCardSales,
        decimal totalTax,
        int totalOrders,
        string? notes)
    {
        if (Status != ShiftStatus.Open)
        {
            return PosErrors.ShiftNotOpen;
        }

        Status = ShiftStatus.Closed;
        ClosingCash = closingCash;
        TotalSales = totalSales;
        TotalCashSales = totalCashSales;
        TotalCardSales = totalCardSales;
        TotalTax = totalTax;
        TotalOrders = totalOrders;
        ExpectedCash = OpeningCash + totalCashSales;
        CashVariance = closingCash - ExpectedCash;
        Notes = notes?.Trim();
        ClosedAt = DateTime.UtcNow;

        return Result.Success;
    }
}
