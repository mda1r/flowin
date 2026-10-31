using NexusPOS.Inventory.Domain.Enums;

namespace NexusPOS.Inventory.Application.Common;

public sealed record StockMovementResponse(
    Guid Id,
    MovementType Type,
    decimal Quantity,
    decimal QuantityBefore,
    decimal QuantityAfter,
    string? Reference,
    string? Notes,
    DateTime OccurredAt,
    Guid? UserId = null,
    long? InvoiceNumber = null);

public sealed record StockMovementsPageResponse(
    IReadOnlyList<StockMovementResponse> Items,
    int Page,
    int PageSize,
    int TotalCount);
