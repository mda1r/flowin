using ErrorOr;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Organization.Infrastructure.Persistence;

namespace NexusPOS.Organization.Application.Commands.UpdateTenantProfile;

internal sealed class UpdateTenantProfileCommandHandler(
    ITenantRepository tenantRepository,
    OrganizationDbContext dbContext)
    : ICommandHandler<UpdateTenantProfileCommand, TenantResponse>
{
    public async Task<ErrorOr<TenantResponse>> Handle(
        UpdateTenantProfileCommand request,
        CancellationToken cancellationToken)
    {
        Tenant? tenant = await tenantRepository.FindByIdAsync(
            new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return OrganizationErrors.TenantNotFound;
        }

        tenant.UpdateProfile(
            request.Name,
            request.Currency,
            request.TimeZone,
            request.LogoUrl,
            request.PhoneNumber,
            request.TaxId);

        tenantRepository.Update(tenant);
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
