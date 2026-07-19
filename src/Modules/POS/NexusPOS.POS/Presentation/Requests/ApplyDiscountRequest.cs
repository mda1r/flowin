using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Presentation.Requests;

public sealed record ApplyDiscountRequest(DiscountType DiscountType, decimal DiscountValue);
