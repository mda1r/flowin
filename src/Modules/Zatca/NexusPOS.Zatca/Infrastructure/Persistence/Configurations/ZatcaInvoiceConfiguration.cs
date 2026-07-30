using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Zatca.Domain.Entities;

namespace NexusPOS.Zatca.Infrastructure.Persistence.Configurations;

internal sealed class ZatcaInvoiceConfiguration : IEntityTypeConfiguration<ZatcaInvoice>
{
    public void Configure(EntityTypeBuilder<ZatcaInvoice> builder)
    {
        builder.ToTable("zatca_invoices");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
        builder.Property(x => x.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(50).IsRequired();
        builder.Property(x => x.InvoiceDate).HasColumnName("invoice_date").IsRequired();
        builder.Property(x => x.SellerName).HasColumnName("seller_name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.SellerVatNumber).HasColumnName("seller_vat_number").HasMaxLength(50).IsRequired();
        builder.Property(x => x.SubtotalAmount).HasColumnName("subtotal_amount").HasPrecision(18, 4).IsRequired();
        builder.Property(x => x.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 4).IsRequired();
        builder.Property(x => x.TotalAmount).HasColumnName("total_amount").HasPrecision(18, 4).IsRequired();
        builder.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();
        builder.Property(x => x.QrCodeBase64).HasColumnName("qr_code_base64").IsRequired();
        builder.Property(x => x.XmlContent).HasColumnName("xml_content").IsRequired();
        builder.Property(x => x.Phase).HasColumnName("phase").IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(x => x.OrderId).IsUnique();
        builder.HasIndex(x => new { x.TenantId, x.InvoiceNumber });
    }
}
