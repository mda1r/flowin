using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Zatca.Domain.Entities;

namespace NexusPOS.Zatca.Infrastructure.Persistence.Configurations;

internal sealed class ZatcaSettingsConfiguration : IEntityTypeConfiguration<ZatcaSettings>
{
    public void Configure(EntityTypeBuilder<ZatcaSettings> builder)
    {
        builder.ToTable("zatca_settings");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(x => x.SellerName).HasColumnName("seller_name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.VatRegistrationNumber).HasColumnName("vat_registration_number").HasMaxLength(50).IsRequired();
        builder.Property(x => x.IsPhase2Enabled).HasColumnName("is_phase2_enabled").IsRequired();
        builder.Property(x => x.CertificateBase64).HasColumnName("certificate_base64");
        builder.Property(x => x.CertificateExpiryDate).HasColumnName("certificate_expiry_date");
        builder.Property(x => x.InvoiceCounter).HasColumnName("invoice_counter").IsRequired();
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(x => x.TenantId).IsUnique();
    }
}
