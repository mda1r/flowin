using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Infrastructure.Persistence.Configurations;

internal sealed class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("reservations");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasConversion(id => id.Value, value => new ReservationId(value))
            .HasColumnName("id");

        builder.Property(r => r.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(r => r.BranchId).HasColumnName("branch_id").IsRequired();
        builder.Property(r => r.RoomId).HasColumnName("room_id").IsRequired();
        builder.Property(r => r.GuestName).HasColumnName("guest_name").HasMaxLength(256).IsRequired();
        builder.Property(r => r.GuestNationalId).HasColumnName("guest_national_id").HasMaxLength(128).IsRequired();
        builder.Property(r => r.GuestPhone).HasColumnName("guest_phone").HasMaxLength(64).IsRequired();
        builder.Property(r => r.CheckIn).HasColumnName("check_in").IsRequired();
        builder.Property(r => r.CheckOut).HasColumnName("check_out").IsRequired();
        builder.Property(r => r.Nights).HasColumnName("nights").IsRequired();
        builder.Property(r => r.RatePerNight).HasColumnName("rate_per_night").HasPrecision(18, 4).IsRequired();
        builder.Property(r => r.TotalAmount).HasColumnName("total_amount").HasPrecision(18, 4).IsRequired();

        builder.Property(r => r.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(r => r.Notes).HasColumnName("notes").HasMaxLength(512);
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(r => r.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(r => r.BranchId).HasDatabaseName("ix_reservations_branch_id");
        builder.HasIndex(r => r.RoomId).HasDatabaseName("ix_reservations_room_id");
        builder.HasIndex(r => new { r.BranchId, r.Status }).HasDatabaseName("ix_reservations_branch_status");
        builder.HasIndex(r => r.CheckOut).HasDatabaseName("ix_reservations_check_out");

        builder.Ignore(r => r.DomainEvents);
    }
}
