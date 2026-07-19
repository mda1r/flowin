namespace NexusPOS.Purchasing.Domain.Enums;

public enum PurchaseOrderStatus
{
    Draft = 1,
    Sent = 2,
    PartiallyReceived = 3,
    Received = 4,
    Cancelled = 5,
}
