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
        // Split payments count their card portion as entered and the rest of the bill as cash. The cashier's
        // two halves only match the 4-decimal total to the halala, so the leftover stays in cash, not digital.
        decimal card = list.Sum(r => r.Method switch
        {
            PaymentMethod.Card => r.Total,
            PaymentMethod.Split => SplitCardPart(r),
            _ => 0m,
        });
        decimal cash = list.Sum(r => r.Method switch
        {
            PaymentMethod.Cash => r.Total,
            PaymentMethod.Split => r.Total - SplitCardPart(r),
            _ => 0m,
        });
        decimal digital = list
            .Where(r => r.Method is not (PaymentMethod.Cash or PaymentMethod.Card or PaymentMethod.Split))
            .Sum(r => r.Total);

        return new ShiftTotals(
            total,
            cash,
            card,
            digital,
            Math.Max(0m, cashRefunds),
            list.Sum(r => r.Tax),
            list.Sum(r => r.Orders));
    }

    // The card part can never exceed the bill, so a bad split from a client cannot turn cash negative.
    private static decimal SplitCardPart(ShiftPaymentRow r) => Math.Clamp(r.SplitCard, 0m, Math.Max(r.Total, 0m));
}
