using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateBrand;

internal sealed class CreateBrandCommandHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb)
    : ICommandHandler<CreateBrandCommand, BrandResponse>
{
    public async Task<ErrorOr<BrandResponse>> Handle(
        CreateBrandCommand request,
        CancellationToken cancellationToken)
    {
        string code = request.Code.Trim().ToUpperInvariant();

        bool codeTaken = await orgDb.Brands
            .AnyAsync(b => b.Code == code, cancellationToken);

        if (codeTaken)
        {
            return Error.Conflict("Brand.CodeTaken", $"Brand code '{code}' is already in use");
        }

        Brand brand = Brand.Create(request.NameAr, request.NameEn, code, request.ActorId, request.Notes);
        orgDb.Brands.Add(brand);

        superAdminDb.BrandAuditLogs.Add(BrandAuditLog.Record(
            BrandAuditEvents.BrandCreated, request.ActorId,
            brandId: brand.Id,
            afterJson: $"{{\"name_ar\":\"{brand.NameAr}\",\"name_en\":\"{brand.NameEn}\",\"code\":\"{brand.Code}\"}}"));

        await orgDb.SaveChangesAsync(cancellationToken);
        try { await superAdminDb.SaveChangesAsync(cancellationToken); }
        catch (Exception) { /* audit log is non-critical — brand committed successfully */ }

        return new BrandResponse(
            brand.Id, brand.NameAr, brand.NameEn, brand.Code,
            brand.Status, brand.Notes, 0, brand.CreatedAt);
    }
}
