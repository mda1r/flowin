using ErrorOr;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.SetTenantVat;

internal sealed class SetTenantVatCommandHandler(ITenantRepository tenants, OrganizationDbContext db)
    : ICommandHandler<SetTenantVatCommand, TenantVatResponse>
{
    public async Task<ErrorOr<TenantVatResponse>> Handle(SetTenantVatCommand request, CancellationToken cancellationToken)
    {
        Tenant? tenant = await tenants.FindByIdAsync(new TenantId(request.TenantId), cancellationToken);
        if (tenant is null)
        {
            return OrganizationErrors.TenantNotFound;
        }

        tenant.SetVatEnabled(request.Enabled);
        tenants.Update(tenant);
        await db.SaveChangesAsync(cancellationToken);
        return new TenantVatResponse(tenant.VatEnabled);
    }
}
