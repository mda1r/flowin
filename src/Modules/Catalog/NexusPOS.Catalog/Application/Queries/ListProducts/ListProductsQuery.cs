using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.ListProducts;

// Limit caps the list (the till asks for one screenful); null keeps the full catalogue for back-office pages.
public sealed record ListProductsQuery(Guid? CategoryId = null, string? Search = null, int? Limit = null) : IQuery<IReadOnlyList<ProductResponse>>;
