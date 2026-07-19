using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Infrastructure.Persistence.Configurations;

internal sealed class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("rooms");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasConversion(id => id.Value, value => new RoomId(value))
            .HasColumnName("id");

        builder.Property(r => r.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(r => r.BranchId).HasColumnName("branch_id").IsRequired();

        builder.Property(r => r.RoomType)
            .HasConversion<string>()
            .HasColumnName("room_type")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(r => r.RoomNumber).HasColumnName("room_number").HasMaxLength(32).IsRequired();
        builder.Property(r => r.Floor).HasColumnName("floor").IsRequired();
        builder.Property(r => r.Capacity).HasColumnName("capacity").IsRequired();
        builder.Property(r => r.NightlyRate).HasColumnName("nightly_rate").HasPrecision(18, 4).IsRequired();
        builder.Property(r => r.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();

        builder.Property(r => r.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(r => r.CleaningStatus)
            .HasConversion<string>()
            .HasColumnName("cleaning_status")
            .HasMaxLength(16)
            .IsRequired()
            .HasDefaultValue(CleaningStatus.Clean);

        builder.Property(r => r.Description).HasColumnName("description").HasMaxLength(512);
        builder.Property(r => r.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(r => r.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(r => r.BranchId).HasDatabaseName("ix_rooms_branch_id");
        builder.HasIndex(r => new { r.BranchId, r.RoomType }).HasDatabaseName("ix_rooms_branch_type");
        builder.HasIndex(r => new { r.BranchId, r.Status }).HasDatabaseName("ix_rooms_branch_status");
        builder.HasIndex(r => new { r.BranchId, r.RoomNumber })
            .IsUnique()
            .HasDatabaseName("ix_rooms_branch_room_number");

        builder.Ignore(r => r.DomainEvents);
    }
}
