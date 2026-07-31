using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Infrastructure.Persistence.Configurations;

internal sealed class RentalContractConfiguration : IEntityTypeConfiguration<RentalContract>
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public void Configure(EntityTypeBuilder<RentalContract> builder)
    {
        builder.ToTable("rental_contracts");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasConversion(id => id.Value, value => new RentalContractId(value))
            .HasColumnName("id");

        builder.Property(c => c.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(c => c.BranchId).HasColumnName("branch_id").IsRequired();
        builder.Property(c => c.ReservationId).HasColumnName("reservation_id");

        builder.Property(c => c.TenantName).HasColumnName("tenant_name").HasMaxLength(256).IsRequired();
        builder.Property(c => c.TenantNationalId).HasColumnName("tenant_national_id").HasMaxLength(128).IsRequired();
        builder.Property(c => c.TenantPhone).HasColumnName("tenant_phone").HasMaxLength(64).IsRequired();

        builder.Property(c => c.RoomNumber).HasColumnName("room_number").HasMaxLength(32).IsRequired();
        builder.Property(c => c.StartDate).HasColumnName("start_date").IsRequired();
        builder.Property(c => c.EndDate).HasColumnName("end_date").IsRequired();
        builder.Property(c => c.MonthlyRent).HasColumnName("monthly_rent").HasPrecision(18, 4).IsRequired();
        builder.Property(c => c.Currency).HasColumnName("currency").HasMaxLength(8).IsRequired();
        builder.Property(c => c.LandlordName).HasColumnName("landlord_name").HasMaxLength(256).IsRequired();

        builder.Property(c => c.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(c => c.Notes).HasColumnName("notes").HasMaxLength(1024);
        builder.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at").IsRequired();
        builder.Property(c => c.SignedAt).HasColumnName("signed_at");

        // Clauses stored as JSONB column via backing field
        builder.Property<List<ContractClause>>("_clauses")
            .HasField("_clauses")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasColumnName("clauses")
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, _json),
                v => JsonSerializer.Deserialize<List<ContractClause>>(v, _json) ?? new List<ContractClause>())
            .IsRequired();

        builder.HasIndex(c => c.BranchId).HasDatabaseName("ix_rental_contracts_branch_id");
        builder.HasIndex(c => new { c.BranchId, c.Status }).HasDatabaseName("ix_rental_contracts_branch_status");
        builder.HasIndex(c => c.CreatedAt).HasDatabaseName("ix_rental_contracts_created_at");

        builder.Ignore(c => c.DomainEvents);
        builder.Ignore(c => c.Clauses);
    }
}
