using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Organization.Infrastructure.Persistence;

public sealed class OrganizationDbContext(DbContextOptions<OrganizationDbContext> options, MediatR.IPublisher publisher)
    : BaseModuleDbContext(options, publisher)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<TenantBrandMembership> TenantBrandMemberships => Set<TenantBrandMembership>();
}
