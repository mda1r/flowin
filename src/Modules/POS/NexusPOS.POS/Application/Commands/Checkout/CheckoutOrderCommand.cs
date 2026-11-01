using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.Checkout;

// One request for a whole sale: lines, optional discounts and loyalty redemption, and payment. Used online and to sync offline sales.
// ByOwnerOrManager comes from the caller's role (Owner or Manager), never from the request body; UserId and UserName
// are the caller too, for the review note an offline sale can leave.
// Kitchen, when set, sends the sale to the kitchen screen as an already-paid ticket.
// Line.CostPrice is still accepted so older till and offline payloads bind, but it is ignored: the server sets the cost.
// Line.ModifierOptionIds are the add-ons picked for the item; the server prices and checks them. Older payloads leave
// it out, which is the same as picking none.
// DiscountCode is an owner's code typed at the till, sent with the DiscountType and DiscountValue the till charged for
// it. Online the server prices the sale from the code and refuses it when the till's values no longer match; a usable
// code needs no cap or PIN. A queued offline sale keeps the till's values, and leaves a review note when the code was
// deleted, unusable at the sale's time or changed since.
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
    string? ApprovalPin = null,
    bool ByOwnerOrManager = false,
    Guid UserId = default,
    string? UserName = null,
    CheckoutOrderCommand.KitchenTicket? Kitchen = null,
    string? DiscountCode = null) : ICommand<OrderResponse>
{
    public sealed record Line(
        Guid VariantId, string ProductName, string VariantName, decimal UnitPrice, decimal CostPrice, decimal Quantity,
        DiscountType DiscountType = DiscountType.None, decimal DiscountValue = 0m, string? Notes = null,
        IReadOnlyList<Guid>? ModifierOptionIds = null);

    public sealed record KitchenTicket(int? TableNumber, bool Takeaway, string? CallName = null);
}
