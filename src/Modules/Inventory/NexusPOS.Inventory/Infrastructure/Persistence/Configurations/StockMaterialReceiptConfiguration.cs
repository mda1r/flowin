using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockMaterialReceiptConfiguration : IEntityTypeConfiguration<StockMaterialReceipt>
{
    public void Configure(EntityTypeBuilder<StockMaterialReceipt> builder)
    {
        builder.ToTable("stock_material_receipts");
        builder.HasKey(r => r.PurchaseOrderId);

        builder.Property(r => r.PurchaseOrderId).HasColumnName("purchase_order_id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id");
        builder.Property(r => r.LineCount).HasColumnName("line_count");
        builder.Property(r => r.AppliedAt).HasColumnName("applied_at");
    }
}
