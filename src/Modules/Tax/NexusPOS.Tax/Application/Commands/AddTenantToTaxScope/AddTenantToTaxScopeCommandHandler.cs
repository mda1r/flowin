using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.AddTenantToTaxScope;

internal sealed class AddTenantToTaxScopeCommandHandler(
    TaxConfigDbContext taxDb,
    OrganizationDbContext orgDb)
    : ICommandHandler<AddTenantToTaxScopeCommand, TaxScopeMemberResponse>
{
    public async Task<ErrorOr<TaxScopeMemberResponse>> Handle(
        AddTenantToTaxScopeCommand request,
        CancellationToken cancellationToken)
    {
        bool scopeExists = await taxDb.TaxRegistrationScopes
            .AnyAsync(s => s.Id == request.TaxScopeId && s.IsActive, cancellationToken);

        if (!scopeExists)
        {
            return Error.NotFound("TaxScope.NotFound", "نطاق التسجيل الضريبي غير موجود أو غير نشط");
        }

        var tenant = await orgDb.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "المنشأة غير موجودة");
        }

        bool alreadyMember = await taxDb.TaxScopeMemberships
            .AnyAsync(m => m.TaxScopeId == request.TaxScopeId
                        && m.TenantId == request.TenantId
                        && m.EffectiveTo == null, cancellationToken);

        if (alreadyMember)
        {
            return Error.Conflict("TaxScope.AlreadyMember", "المنشأة ضمن هذا النطاق الضريبي مسبقاً");
        }

        TaxScopeMembership membership = TaxScopeMembership.Create(
            request.TaxScopeId, request.TenantId, request.EffectiveFrom, request.ActorId);

        taxDb.TaxScopeMemberships.Add(membership);
        await taxDb.SaveChangesAsync(cancellationToken);

        return new TaxScopeMemberResponse(
            membership.Id, tenant.Id.Value, tenant.Name,
            membership.EffectiveFrom, membership.EffectiveTo);
    }
}
