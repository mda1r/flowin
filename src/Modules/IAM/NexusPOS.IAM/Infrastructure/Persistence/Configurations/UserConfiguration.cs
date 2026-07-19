using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id)
            .HasColumnName("id")
            .HasConversion(
                id => id.Value,
                value => new UserId(value));

        builder.Property(u => u.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.OwnsOne(u => u.Email, nav =>
        {
            nav.Property(e => e.Value)
                .HasColumnName("email")
                .HasMaxLength(256)
                .IsRequired();

            nav.HasIndex(e => e.Value)
                .IsUnique()
                .HasDatabaseName("ix_users_email");
        });

        builder.OwnsOne(u => u.PasswordHash, nav =>
        {
            nav.Property(p => p.Hash)
                .HasColumnName("password_hash")
                .HasMaxLength(512);
        });

        builder.Property(u => u.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired(false);

        builder.Property(u => u.IsEmailVerified)
            .HasColumnName("is_email_verified")
            .HasDefaultValue(false);

        builder.Property(u => u.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(u => u.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(u => u.LastLoginAt)
            .HasColumnName("last_login_at");

        builder.Property(u => u.FailedLoginAttempts)
            .HasColumnName("failed_login_attempts")
            .HasDefaultValue(0);

        builder.Property(u => u.LockedUntil)
            .HasColumnName("locked_until");

        builder.PrimitiveCollection(u => u.Roles)
            .HasColumnName("roles")
            .ElementType(b => b.HasConversion<int>());

        builder.HasMany(u => u.RefreshTokens)
            .WithOne()
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(u => u.PasskeyCredentials)
            .WithOne()
            .HasForeignKey(pc => pc.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(u => u.TotpSecret)
            .WithOne()
            .HasForeignKey<TOTPSecret>(ts => ts.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
