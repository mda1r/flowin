namespace NexusPOS.SharedKernel.Domain;

// A store's loyalty programme, set by its owner: points earned per riyal paid, what a block of points is worth
// off the amount paid (VAT included), and the smallest balance a customer can start redeeming from.
public sealed record LoyaltyRules(
    bool Enabled,
    decimal PointsPerCurrencyUnit,
    int RedeemPoints,
    decimal RedeemValue,
    int MinRedeemPoints)
{
    // What every store starts with: 1 point per riyal, 100 points = 5 riyals, redeemable from any balance.
    public static readonly LoyaltyRules Default = new(true, 1m, 100, 5m, 0);

    // Rounded so the till, the server and the stored order all agree on the same figure.
    public decimal ValuePerPoint => Math.Round(RedeemValue / RedeemPoints, 6);

    // On the amount actually paid in halalas: totals are kept to four decimals, and 104.9999 must earn like 105.00.
    public int PointsEarned(decimal amountPaid) =>
        !Enabled || amountPaid <= 0 ? 0 : (int)Math.Floor(Math.Round(amountPaid, 2) * PointsPerCurrencyUnit);

    public static decimal ValueOf(int points, decimal valuePerPoint) => Math.Round(points * valuePerPoint, 2);
}
