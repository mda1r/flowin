using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.SuperAdmin.Domain.Entities;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence.Configurations;

internal sealed class BrandAuditLogConfiguration : IEntityTypeConfiguration<BrandAuditLog>
{
    public void Configure(EntityTypeBuilder<BrandAuditLog> builder)
    {
        builder.ToTable("brand_audit_logs", "superadmin");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");

        builder.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(128).IsRequired();
        builder.Property(x => x.BrandId).HasColumnName("brand_id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id");
        builder.Property(x => x.TaxScopeId).HasColumnName("tax_scope_id");
        builder.Property(x => x.ActorId).HasColumnName("actor_id").IsRequired();
        builder.Property(x => x.OccurredAt).HasColumnName("occurred_at").IsRequired();
        builder.Property(x => x.BeforeJson).HasColumnName("before_json").HasColumnType("jsonb");
        builder.Property(x => x.AfterJson).HasColumnName("after_json").HasColumnType("jsonb");
        builder.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(512);

        builder.HasIndex(x => x.BrandId);
        builder.HasIndex(x => x.TenantId);
        builder.HasIndex(x => x.OccurredAt);
    }
}
