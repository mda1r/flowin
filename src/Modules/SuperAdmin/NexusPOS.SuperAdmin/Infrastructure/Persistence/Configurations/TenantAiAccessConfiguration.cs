using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.SuperAdmin.Domain.Entities;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence.Configurations;

internal sealed class TenantAiAccessConfiguration : IEntityTypeConfiguration<TenantAiAccess>
{
    public void Configure(EntityTypeBuilder<TenantAiAccess> builder)
    {
        builder.ToTable("tenant_ai_access", "superadmin");
        builder.HasKey(a => a.TenantId);
        builder.Property(a => a.TenantId).HasColumnName("tenant_id");
        builder.Property(a => a.AiEnabled).HasColumnName("ai_enabled").HasDefaultValue(false);
        builder.Property(a => a.UpdatedAt).HasColumnName("updated_at");
    }
}
