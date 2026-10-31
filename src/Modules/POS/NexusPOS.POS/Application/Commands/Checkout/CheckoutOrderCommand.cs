using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.Checkout;

// One request for a whole sale: lines, optional loyalty redemption and payment. Used online and to sync offline sales.
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
    DateTime? OfflineCreatedAt) : ICommand<OrderResponse>
{
    public sealed record Line(Guid VariantId, string ProductName, string VariantName, decimal UnitPrice, decimal CostPrice, decimal Quantity);
}
