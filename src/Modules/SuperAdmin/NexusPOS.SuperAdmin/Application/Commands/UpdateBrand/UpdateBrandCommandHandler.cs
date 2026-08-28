using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.UpdateBrand;

internal sealed class UpdateBrandCommandHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb)
    : ICommandHandler<UpdateBrandCommand, BrandResponse>
{
    public async Task<ErrorOr<BrandResponse>> Handle(
        UpdateBrandCommand request,
        CancellationToken cancellationToken)
    {
        var brand = await orgDb.Brands
            .FirstOrDefaultAsync(b => b.Id == request.BrandId, cancellationToken);

        if (brand is null)
        {
            return Error.NotFound("Brand.NotFound", "Brand not found");
        }

        brand.Update(request.NameAr, request.NameEn, request.Notes);

        if (!string.IsNullOrEmpty(request.Status))
        {
            brand.SetStatus(request.Status);
        }

        int memberCount = await orgDb.TenantBrandMemberships
            .CountAsync(m => m.BrandId == brand.Id && m.UnlinkedAt == null, cancellationToken);

        superAdminDb.BrandAuditLogs.Add(BrandAuditLog.Record(
            BrandAuditEvents.BrandUpdated, request.ActorId, brandId: brand.Id));

        await orgDb.SaveChangesAsync(cancellationToken);
        await superAdminDb.SaveChangesAsync(cancellationToken);

        return new BrandResponse(
            brand.Id, brand.NameAr, brand.NameEn, brand.Code,
            brand.Status, brand.Notes, memberCount, brand.CreatedAt);
    }
}
