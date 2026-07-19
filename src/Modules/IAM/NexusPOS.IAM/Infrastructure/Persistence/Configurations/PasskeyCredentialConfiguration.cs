using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Infrastructure.Persistence.Configurations;

internal sealed class PasskeyCredentialConfiguration : IEntityTypeConfiguration<PasskeyCredential>
{
    public void Configure(EntityTypeBuilder<PasskeyCredential> builder)
    {
        builder.ToTable("passkey_credentials");

        builder.HasKey(pc => pc.Id);

        builder.Property(pc => pc.Id)
            .HasColumnName("id");

        builder.Property(pc => pc.UserId)
            .HasColumnName("user_id")
            .HasConversion(
                id => id.Value,
                value => new UserId(value))
            .IsRequired();

        builder.Property(pc => pc.CredentialId)
            .HasColumnName("credential_id")
            .IsRequired();

        builder.HasIndex(pc => pc.CredentialId)
            .IsUnique()
            .HasDatabaseName("ix_passkey_credentials_credential_id");

        builder.Property(pc => pc.PublicKey)
            .HasColumnName("public_key")
            .IsRequired();

        builder.Property(pc => pc.SignCount)
            .HasColumnName("sign_count")
            .HasDefaultValue(0u);

        builder.Property(pc => pc.DeviceName)
            .HasColumnName("device_name")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(pc => pc.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(pc => pc.LastUsedAt)
            .HasColumnName("last_used_at");
    }
}
