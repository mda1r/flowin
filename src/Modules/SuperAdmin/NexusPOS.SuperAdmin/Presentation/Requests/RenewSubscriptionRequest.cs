namespace NexusPOS.SuperAdmin.Presentation.Requests;

/// <summary>SubscriptionId is the subscription the admin was shown; the renewal is refused if it is no longer the end of the chain.</summary>
public sealed record RenewSubscriptionRequest(int Months, Guid? SubscriptionId = null);
