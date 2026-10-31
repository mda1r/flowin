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
    public decimal TotalDigitalSales { get; private set; }
    public decimal TotalCashRefunds { get; private set; }
    public decimal TotalTax { get; private set; }
    public int TotalOrders { get; private set; }

    // Everything handed back on returns during the shift; the cash part is TotalCashRefunds.
    public decimal TotalRefunds { get; private set; }
    public decimal? ExpectedCash { get; private set; }
    public decimal? CashVariance { get; private set; }
    public decimal? ClosingCardCount { get; private set; }
    public decimal? CardVariance { get; private set; }
    public string? Notes { get; private set; }
    public DateTime OpenedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    // Set when a manager closed the shift on the cashier's behalf; null when the cashier closed it.
    public string? ClosedByName { get; private set; }

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

    /// <summary>Cash that should be in the drawer: the float plus cash taken, less cash handed back on returns.</summary>
    public decimal ExpectedCashFor(ShiftTotals totals) => OpeningCash + totals.CashSales - totals.CashRefunds;

    public ErrorOr<Success> Close(
        decimal closingCash,
        decimal closingCardCount,
        ShiftTotals totals,
        string? notes,
        string? closedByName = null)
    {
        if (Status != ShiftStatus.Open)
        {
            return PosErrors.ShiftNotOpen;
        }

        Status = ShiftStatus.Closed;
        ClosingCash = closingCash;
        TotalSales = totals.TotalSales;
        TotalCashSales = totals.CashSales;
        TotalCardSales = totals.CardSales;
        TotalDigitalSales = totals.DigitalSales;
        TotalCashRefunds = totals.CashRefunds;
        TotalRefunds = totals.TotalRefunds;
        // Sales stay gross; VAT is what remains due after refunds, and each refund leaves the till it was paid from.
        TotalTax = totals.Tax - totals.RefundTax;
        TotalOrders = totals.Orders;
        ExpectedCash = ExpectedCashFor(totals);
        CashVariance = closingCash - ExpectedCash;
        ClosingCardCount = closingCardCount;
        CardVariance = closingCardCount - (totals.CardSales - totals.CardRefunds);
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        ClosedByName = string.IsNullOrWhiteSpace(closedByName) ? null : closedByName.Trim();
        ClosedAt = DateTime.UtcNow;

        return Result.Success;
    }
}
