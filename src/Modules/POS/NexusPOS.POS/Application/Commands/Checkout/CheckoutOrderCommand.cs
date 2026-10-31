using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.Checkout;

// One request for a whole sale: lines, optional discount, loyalty redemption and payment. Used online and to sync offline sales.
// IsManager comes from the caller's role, never from the request body: it lifts the cashier discount cap and the catalog price check
// (a synced offline sale skips them too, see CheckoutBuilder).
// Kitchen, when set, sends the sale to the kitchen screen as an already-paid ticket.
public sealed record CheckoutOrderCommand(
    Guid TenantId,
    Guid BranchId,
    Guid ClientReference,
    string Currency,
    decimal TaxRate,
    Guid? CustomerId,
    IReadOnlyList<CheckoutOrderCommand.Line> Lines,
    int LoyaltyPoints,
    PaymentMethod PaymentMethod,
    decimal AmountTendered,
    decimal? CashAmount,
    decimal? CardAmount,
    DateTime? OfflineCreatedAt,
    DiscountType DiscountType = DiscountType.None,
    decimal DiscountValue = 0m,
    bool IsManager = false,
    CheckoutOrderCommand.KitchenTicket? Kitchen = null) : ICommand<OrderResponse>
{
    // The largest order discount a cashier can give without an owner or manager, as a share of the bill.
    public const decimal CashierDiscountCapPercent = 20m;

    public sealed record Line(
        Guid VariantId, string ProductName, string VariantName, decimal UnitPrice, decimal CostPrice, decimal Quantity,
        string? Notes = null);

    public sealed record KitchenTicket(int? TableNumber, bool Takeaway);
}
