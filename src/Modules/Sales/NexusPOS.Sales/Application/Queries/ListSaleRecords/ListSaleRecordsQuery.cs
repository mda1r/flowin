using NexusPOS.Sales.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.ListSaleRecords;

public sealed record ListSaleRecordsQuery(
    Guid BranchId,
    DateTime DateFrom,
    DateTime DateTo,
    int Page = 1,
    int PageSize = 50) : IQuery<IReadOnlyList<SaleRecordResponse>>;
