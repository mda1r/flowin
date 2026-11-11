using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.Infrastructure.Persistence;

// Product photos live in one shared schema rather than each tenant's, so the public image address can be served
// without a signed-in tenant. Every row carries its tenant id; uploads and deletes are always filtered by the
// caller's tenant from the token. Configured here (not by assembly scan) so the tenant catalogue never gets the table.
public sealed class CatalogMediaDbContext(DbContextOptions<CatalogMediaDbContext> options) : DbContext(options)
{
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("catalog_media");
        modelBuilder.Entity<ProductImage>(b =>
        {
            b.ToTable("product_images");
            b.HasKey(i => i.Id);
            b.Property(i => i.Id).HasColumnName("id").ValueGeneratedNever();
            b.Property(i => i.TenantId).HasColumnName("tenant_id").IsRequired();
            b.Property(i => i.ProductId).HasColumnName("product_id").IsRequired();
            b.Property(i => i.ContentType).HasColumnName("content_type").HasMaxLength(32).IsRequired();
            b.Property(i => i.Data).HasColumnName("data").IsRequired();
            b.Property(i => i.CreatedAt).HasColumnName("created_at").IsRequired();
            b.HasIndex(i => new { i.TenantId, i.ProductId }).HasDatabaseName("ix_product_images_tenant_product");
        });
    }
}
