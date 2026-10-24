using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetMaterialsReceiptStatus;

public sealed record MaterialsReceiptStatusResponse(Guid PurchaseOrderId, bool Applied, DateTime? AppliedAt, int LineCount);

public sealed record GetMaterialsReceiptStatusQuery(Guid TenantId, Guid PurchaseOrderId) : IQuery<MaterialsReceiptStatusResponse>;

internal sealed class GetMaterialsReceiptStatusQueryHandler(InventoryDbContext db)
    : IQueryHandler<GetMaterialsReceiptStatusQuery, MaterialsReceiptStatusResponse>
{
    public async Task<ErrorOr<MaterialsReceiptStatusResponse>> Handle(
        GetMaterialsReceiptStatusQuery request, CancellationToken cancellationToken)
    {
        var receipt = await db.StockMaterialReceipts
            .Where(r => r.PurchaseOrderId == request.PurchaseOrderId && r.TenantId == request.TenantId)
            .Select(r => new { r.AppliedAt, r.LineCount })
            .FirstOrDefaultAsync(cancellationToken);

        return receipt is null
            ? new MaterialsReceiptStatusResponse(request.PurchaseOrderId, false, null, 0)
            : new MaterialsReceiptStatusResponse(request.PurchaseOrderId, true, receipt.AppliedAt, receipt.LineCount);
    }
}
