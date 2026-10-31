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

    // Money handed back on returns during the shift; cash refunds come out of the drawer's expected cash.
    public decimal TotalRefunds { get; private set; }
    public decimal CashRefunds { get; private set; }
    public decimal? ExpectedCash { get; private set; }
    public decimal? CashVariance { get; private set; }
    public decimal? ClosingCardCount { get; private set; }
    public decimal? CardVariance { get; private set; }
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
        decimal closingCardCount,
        decimal totalSales,
        decimal totalCashSales,
        decimal totalCardSales,
        decimal totalTax,
        int totalOrders,
        string? notes,
        ShiftRefunds? refunds = null)
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
        TotalOrders = totalOrders;
        ShiftRefunds r = refunds ?? ShiftRefunds.None;
        TotalRefunds = r.Total;
        CashRefunds = r.Cash;

        // Sales stay gross; VAT is what remains due after refunds, and each refund leaves the till it was paid from.
        TotalTax = totalTax - r.Tax;
        ExpectedCash = OpeningCash + totalCashSales - r.Cash;
        CashVariance = closingCash - ExpectedCash;
        ClosingCardCount = closingCardCount;
        CardVariance = closingCardCount - (totalCardSales - r.Card);
        Notes = notes?.Trim();
        ClosedAt = DateTime.UtcNow;

        return Result.Success;
    }
}

// Returns refunded during a shift, split by how the money went back.
public sealed record ShiftRefunds(decimal Total, decimal Cash, decimal Card, decimal Tax)
{
    public static readonly ShiftRefunds None = new(0m, 0m, 0m, 0m);
}
