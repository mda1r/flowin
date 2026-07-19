using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.UpdateProduct;

public sealed record UpdateProductCommand(
    Guid ProductId,
    string Name,
    string? Description,
    Guid? CategoryId,
    TaxClass TaxClass,
    bool TrackInventory,
    string? ImageUrl = null) : ICommand<ProductResponse>;
