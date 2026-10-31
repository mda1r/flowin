namespace NexusPOS.CRM.Application.Services;

// How many points a refund moves, given what the sale earned and spent and how much of it has been returned.
// Targets are cumulative over all returns of the sale, so several partial returns add up to exactly one full return.
internal static class LoyaltyReversal
{
    public readonly record struct Result(int TakeBack, int GiveBack);

    public static Result Compute(
        int pointsEarned,
        int pointsRedeemed,
        decimal orderTotal,
        decimal pointsValue,
        decimal returnedShare,
        decimal refundedToDate,
        int alreadyTakenBack,
        int alreadyGivenBack)
    {
        decimal share = Math.Clamp(returnedShare, 0m, 1m);

        // Earned points follow the goods: return half the sale, lose half its points.
        int takeTarget = (int)Math.Round(Math.Max(pointsEarned, 0) * share, MidpointRounding.AwayFromZero);
        int takeBack = Math.Max(0, takeTarget - alreadyTakenBack);

        // Redeemed points come back only for the part of their value the cash refund did not already pay out:
        // a refund of the full shelf price on a sale paid partly with points has returned that value in cash.
        int giveBack = 0;
        if (pointsRedeemed > 0 && pointsValue > 0)
        {
            decimal cashOver = Math.Max(0m, Math.Round(refundedToDate - (share * orderTotal), 2));
            decimal valueOwed = Math.Max(0m, Math.Round((share * pointsValue) - cashOver, 2));
            int giveTarget = (int)Math.Floor(Math.Round(pointsRedeemed * valueOwed / pointsValue, 6));
            giveBack = Math.Max(0, Math.Min(giveTarget, pointsRedeemed) - alreadyGivenBack);
        }

        return new Result(takeBack, giveBack);
    }
}
