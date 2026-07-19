using NexusPOS.Catalog.Domain.Enums;

namespace NexusPOS.Catalog.Presentation.Requests;

public sealed record UpdateProductRequest(
    string Name,
    string? Description,
    Guid? CategoryId,
    TaxClass TaxClass,
    bool TrackInventory,
    string? ImageUrl = null);
