namespace NexusPOS.SharedKernel.Domain;

// Store-wide loyalty rules: 1 point per riyal paid; 100 points are worth 5 riyals off the amount paid (VAT included).
public static class LoyaltyPolicy
{
    public const decimal PointsPerCurrencyUnit = 1m;
    public const decimal ValuePerPoint = 0.05m;

    public static int PointsEarned(decimal amountPaid) =>
        amountPaid <= 0 ? 0 : (int)Math.Floor(amountPaid * PointsPerCurrencyUnit);

    public static decimal ValueOf(int points) => points * ValuePerPoint;
}
