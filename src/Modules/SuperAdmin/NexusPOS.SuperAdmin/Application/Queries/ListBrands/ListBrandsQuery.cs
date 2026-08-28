using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Queries.ListBrands;

public sealed record ListBrandsQuery(
    string? Status,
    string? Search,
    int Page = 1,
    int PageSize = 20) : IQuery<ListBrandsResult>;

public sealed record ListBrandsResult(
    List<BrandResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);
