using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Zatca.Domain.Entities;

namespace NexusPOS.Zatca.Infrastructure.Persistence.Configurations;

internal sealed class ReceiptSettingsConfiguration : IEntityTypeConfiguration<ReceiptSettings>
{
    public void Configure(EntityTypeBuilder<ReceiptSettings> builder)
    {
        builder.ToTable("receipt_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(x => x.LogoPath).HasColumnName("logo_path").HasMaxLength(200);
        builder.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
        builder.Property(x => x.Address).HasColumnName("address").HasMaxLength(200);
        builder.Property(x => x.HeaderNote).HasColumnName("header_note").HasMaxLength(300);
        builder.Property(x => x.FooterNote).HasColumnName("footer_note").HasMaxLength(500);
        builder.Property(x => x.PaperWidthMm).HasColumnName("paper_width_mm").HasDefaultValue(80);
        builder.Property(x => x.ShowPoweredBy).HasColumnName("show_powered_by").HasDefaultValue(true);
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        builder.HasIndex(x => x.TenantId).IsUnique().HasDatabaseName("ix_receipt_settings_tenant");
    }
}
