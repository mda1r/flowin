using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Infrastructure.Persistence.Configurations;

internal sealed class TaxExpenseInvoiceConfiguration : IEntityTypeConfiguration<TaxExpenseInvoice>
{
    public void Configure(EntityTypeBuilder<TaxExpenseInvoice> builder)
    {
        builder.ToTable("tax_expense_invoices");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.PeriodId).HasColumnName("period_id");
        builder.Property(e => e.SupplierName).HasColumnName("supplier_name").HasMaxLength(256).IsRequired();
        builder.Property(e => e.SupplierVatNumber).HasColumnName("supplier_vat_number").HasMaxLength(15);
        builder.Property(e => e.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(100).IsRequired();
        builder.Property(e => e.InvoiceDate).HasColumnName("invoice_date").IsRequired();
        builder.Property(e => e.BaseAmount).HasColumnName("base_amount").HasColumnType("numeric(18,4)").IsRequired();
        builder.Property(e => e.TaxAmount).HasColumnName("tax_amount").HasColumnType("numeric(18,4)").IsRequired();
        builder.Property(e => e.TaxRate).HasColumnName("tax_rate").HasColumnType("numeric(6,4)").IsRequired();
        builder.Property(e => e.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();
        builder.Property(e => e.Notes).HasColumnName("notes").HasMaxLength(500);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(e => new { e.TenantId, e.PeriodId }).HasDatabaseName("ix_tax_expense_invoices_tenant_period");
        builder.HasIndex(e => new { e.TenantId, e.InvoiceDate }).HasDatabaseName("ix_tax_expense_invoices_tenant_date");
    }
}
