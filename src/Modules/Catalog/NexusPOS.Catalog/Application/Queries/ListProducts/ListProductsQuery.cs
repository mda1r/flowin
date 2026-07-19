using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.ListProducts;

public sealed record ListProductsQuery(Guid? CategoryId = null, string? Search = null) : IQuery<IReadOnlyList<ProductResponse>>;
