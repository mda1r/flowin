using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.ValueObjects;

namespace NexusPOS.Finance.Infrastructure.Persistence.Configurations;

internal sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> builder)
    {
        builder.ToTable("expenses");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasConversion(id => id.Value, value => new ExpenseId(value))
            .HasColumnName("id");

        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();

        builder.Property(e => e.Category)
            .HasConversion<string>()
            .HasColumnName("category")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(e => e.Amount).HasColumnName("amount").HasPrecision(18, 4).IsRequired();
        builder.Property(e => e.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();
        builder.Property(e => e.Description).HasColumnName("description").HasMaxLength(512).IsRequired();
        builder.Property(e => e.ExpenseDate).HasColumnName("expense_date").IsRequired();

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(e => e.ApprovedBy).HasColumnName("approved_by");
        builder.Property(e => e.VoidReason).HasColumnName("void_reason").HasMaxLength(512);
        builder.Property(e => e.Notes).HasColumnName("notes").HasMaxLength(1024);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(e => e.BranchId).HasDatabaseName("ix_expenses_branch_id");
        builder.HasIndex(e => new { e.BranchId, e.ExpenseDate }).HasDatabaseName("ix_expenses_branch_date");
        builder.HasIndex(e => new { e.BranchId, e.Status }).HasDatabaseName("ix_expenses_branch_status");

        builder.Ignore(e => e.DomainEvents);
    }
}
