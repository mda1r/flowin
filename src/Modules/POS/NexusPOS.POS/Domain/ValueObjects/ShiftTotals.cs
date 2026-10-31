using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Domain.ValueObjects;

/// <summary>Completed sales of one payment method during a shift, as summed by the database.</summary>
public sealed record ShiftPaymentRow(
    PaymentMethod? Method,
    int Orders,
    decimal Total,
    decimal Tax,
    decimal SplitCash,
    decimal SplitCard);

/// <summary>
/// What a shift took in. Cash, card and digital always add up to <see cref="TotalSales"/>: digital also
/// holds anything that is neither cash nor card, so no sale drops out of the reconciliation.
/// </summary>
public sealed record ShiftTotals(
    decimal TotalSales,
    decimal CashSales,
    decimal CardSales,
    decimal DigitalSales,
    decimal CashRefunds,
    decimal Tax,
    int Orders)
{
    public static ShiftTotals Empty { get; } = new(0m, 0m, 0m, 0m, 0m, 0m, 0);

    public static ShiftTotals From(IEnumerable<ShiftPaymentRow> rows, decimal cashRefunds)
    {
        List<ShiftPaymentRow> list = rows.ToList();

        decimal total = list.Sum(r => r.Total);
        // Split payments count their cash and card portions; leaving them out understated expected cash.
        decimal cash = list.Sum(r => r.Method switch
        {
            PaymentMethod.Cash => r.Total,
            PaymentMethod.Split => r.SplitCash,
            _ => 0m,
        });
        decimal card = list.Sum(r => r.Method switch
        {
            PaymentMethod.Card => r.Total,
            PaymentMethod.Split => r.SplitCard,
            _ => 0m,
        });

        return new ShiftTotals(
            total,
            cash,
            card,
            total - cash - card,
            Math.Max(0m, cashRefunds),
            list.Sum(r => r.Tax),
            list.Sum(r => r.Orders));
    }
}
