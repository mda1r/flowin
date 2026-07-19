using ErrorOr;
using NexusPOS.Sales.Application.Common;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.ListSaleRecords;

internal sealed class ListSaleRecordsQueryHandler(ISaleRecordRepository saleRecordRepository)
    : IQueryHandler<ListSaleRecordsQuery, IReadOnlyList<SaleRecordResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<SaleRecordResponse>>> Handle(
        ListSaleRecordsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<SaleRecord> records = await saleRecordRepository.FindByBranchAsync(
            request.BranchId,
            request.DateFrom,
            request.DateTo,
            request.Page,
            request.PageSize,
            cancellationToken);

        return records.Select(r => new SaleRecordResponse(
            r.Id.Value,
            r.OrderId,
            r.BranchId,
            r.Currency,
            r.SubtotalAmount,
            r.DiscountAmount,
            r.TaxAmount,
            r.TotalAmount,
            r.PaymentMethod,
            r.CompletedAt)).ToList();
    }
}
