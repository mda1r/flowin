using ErrorOr;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Organization.Infrastructure.Persistence;

namespace NexusPOS.Organization.Application.Commands.CreateTenant;

internal sealed class CreateTenantCommandHandler(
    ITenantRepository tenantRepository,
    OrganizationDbContext dbContext)
    : ICommandHandler<CreateTenantCommand, TenantResponse>
{
    public async Task<ErrorOr<TenantResponse>> Handle(
        CreateTenantCommand request,
        CancellationToken cancellationToken)
    {
        string subdomain = request.Subdomain.Trim().ToLowerInvariant();

        bool exists = await tenantRepository.ExistsBySubdomainAsync(subdomain, cancellationToken);
        if (exists)
        {
            return OrganizationErrors.SubdomainAlreadyExists;
        }

        Tenant tenant = Tenant.Create(
            request.Name,
            subdomain,
            request.AdminEmail,
            request.Currency,
            request.TimeZone);

        tenantRepository.Add(tenant);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(tenant);
    }

    private static TenantResponse MapToResponse(Tenant tenant) => new(
        tenant.Id.Value,
        tenant.Name,
        tenant.Subdomain,
        tenant.AdminEmail,
        tenant.Plan,
        tenant.IsActive,
        tenant.CreatedAt,
        tenant.Currency,
        tenant.TimeZone,
        tenant.LogoUrl,
        tenant.PhoneNumber,
        tenant.TaxId);
}
