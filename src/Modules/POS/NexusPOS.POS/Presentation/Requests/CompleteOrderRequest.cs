using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Presentation.Requests;

public sealed record CompleteOrderRequest(PaymentMethod PaymentMethod, decimal AmountTendered);
