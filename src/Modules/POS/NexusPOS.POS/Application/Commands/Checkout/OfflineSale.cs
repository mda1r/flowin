namespace NexusPOS.POS.Application.Commands.Checkout;

// offlineCreatedAt comes from the client, so it only counts when the sale reached the server well after the till
// dated it. A live request that adds it (dated now, or in the future) is checked like any other sale.
internal static class OfflineSale
{
    public static readonly TimeSpan MinSyncDelay = TimeSpan.FromMinutes(2);

    public static bool IsOffline(DateTime? offlineCreatedAt, DateTime now) =>
        offlineCreatedAt is { } at && at <= now - MinSyncDelay;
}
