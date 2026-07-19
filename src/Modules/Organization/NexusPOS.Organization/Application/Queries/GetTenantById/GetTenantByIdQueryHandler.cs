using ErrorOr;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Queries.GetTenantById;

internal sealed class GetTenantByIdQueryHandler(ITenantRepository tenantRepository)
    : IQueryHandler<GetTenantByIdQuery, TenantResponse>
{
    public async Task<ErrorOr<TenantResponse>> Handle(
        GetTenantByIdQuery request,
        CancellationToken cancellationToken)
    {
        Tenant? tenant = await tenantRepository.FindByIdAsync(
            new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return OrganizationErrors.TenantNotFound;
        }

        return new TenantResponse(
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
}
