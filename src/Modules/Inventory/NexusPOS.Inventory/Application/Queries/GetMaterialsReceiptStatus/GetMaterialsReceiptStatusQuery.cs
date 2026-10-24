using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetMaterialsReceiptStatus;

public sealed record MaterialsReceiptStatusResponse(
    Guid PurchaseOrderId,
    bool Applied,
    DateTime? AppliedAt,
    int LineCount,
    bool ProductsApplied);

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

        string reference = request.PurchaseOrderId.ToString();
        bool productsApplied = await db.StockMovements.AnyAsync(
            m => m.Reference == reference && m.Type == MovementType.Receive, cancellationToken);

        return new MaterialsReceiptStatusResponse(
            request.PurchaseOrderId, receipt is not null, receipt?.AppliedAt, receipt?.LineCount ?? 0, productsApplied);
    }
}
