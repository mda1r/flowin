using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.CRM.Domain.Entities;

namespace NexusPOS.CRM.Infrastructure.Persistence.Configurations;

internal sealed class LoyaltyTransactionConfiguration : IEntityTypeConfiguration<LoyaltyTransaction>
{
    public void Configure(EntityTypeBuilder<LoyaltyTransaction> builder)
    {
        builder.ToTable("loyalty_transactions");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(t => t.CustomerId).HasColumnName("customer_id").IsRequired();
        builder.Property(t => t.Delta).HasColumnName("delta").IsRequired();
        builder.Property(t => t.Kind).HasColumnName("kind").HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(t => t.OrderId).HasColumnName("order_id");
        builder.Property(t => t.UserId).HasColumnName("user_id");
        builder.Property(t => t.Reason).HasColumnName("reason").HasMaxLength(LoyaltyTransaction.MaxReasonLength);
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(t => new { t.TenantId, t.CustomerId, t.CreatedAt }).HasDatabaseName("ix_loyalty_transactions_customer");
        builder.HasIndex(t => new { t.TenantId, t.OrderId }).HasDatabaseName("ix_loyalty_transactions_order");
    }
}
