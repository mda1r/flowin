using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.CreateProduct;

public sealed record CreateProductCommand(
    string Name,
    string? Description,
    Guid? CategoryId,
    ProductType Type,
    TaxClass TaxClass,
    bool TrackInventory,
    string Sku,
    string VariantName,
    decimal CostPrice,
    decimal SalePrice,
    string Currency,
    string? Barcode = null,
    DateTime? ExpiryDate = null) : ICommand<ProductResponse>;
