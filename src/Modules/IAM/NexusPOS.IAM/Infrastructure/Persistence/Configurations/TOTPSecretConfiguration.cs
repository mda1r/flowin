using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Infrastructure.Persistence.Configurations;

internal sealed class TOTPSecretConfiguration : IEntityTypeConfiguration<TOTPSecret>
{
    public void Configure(EntityTypeBuilder<TOTPSecret> builder)
    {
        builder.ToTable("totp_secrets");

        builder.HasKey(ts => ts.Id);

        builder.Property(ts => ts.Id)
            .HasColumnName("id");

        builder.Property(ts => ts.UserId)
            .HasColumnName("user_id")
            .HasConversion(
                id => id.Value,
                value => new UserId(value))
            .IsRequired();

        builder.HasIndex(ts => ts.UserId)
            .IsUnique()
            .HasDatabaseName("ix_totp_secrets_user_id");

        builder.Property(ts => ts.SecretBase32)
            .HasColumnName("secret_base32")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(ts => ts.IsEnabled)
            .HasColumnName("is_enabled")
            .HasDefaultValue(false);

        builder.Property(ts => ts.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(ts => ts.EnabledAt)
            .HasColumnName("enabled_at");
    }
}
