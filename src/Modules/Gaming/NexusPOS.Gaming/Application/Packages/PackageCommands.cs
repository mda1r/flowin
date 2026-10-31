using ErrorOr;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Packages;

public sealed record ListPackagesQuery(Guid BranchId) : IQuery<IReadOnlyList<GamingPackageResponse>>;

public sealed record CreatePackageCommand(Guid BranchId, string Name, int DurationMinutes, decimal Price, StationType? StationType)
    : ICommand<GamingPackageResponse>;

public sealed record DeletePackageCommand(Guid BranchId, Guid PackageId) : ICommand<Success>;

internal static class PackageMapper
{
    public static GamingPackageResponse ToResponse(GamingPackage p) =>
        new(p.Id, p.Name, p.DurationMinutes, p.Price, p.StationType?.ToString());
}

internal sealed class CreatePackageCommandValidator : AbstractValidator<CreatePackageCommand>
{
    public CreatePackageCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(15, 24 * 60);
        RuleFor(x => x.Price).GreaterThan(0);
    }
}

internal sealed class ListPackagesQueryHandler(GamingDbContext db) : IQueryHandler<ListPackagesQuery, IReadOnlyList<GamingPackageResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<GamingPackageResponse>>> Handle(ListPackagesQuery request, CancellationToken cancellationToken)
    {
        List<GamingPackage> packages = await db.GamingPackages
            .Where(p => p.BranchId == request.BranchId && p.IsActive)
            .OrderBy(p => p.Price)
            .ToListAsync(cancellationToken);
        return packages.Select(PackageMapper.ToResponse).ToList();
    }
}

internal sealed class CreatePackageCommandHandler(GamingDbContext db, ITenantContext tenantContext)
    : ICommandHandler<CreatePackageCommand, GamingPackageResponse>
{
    public async Task<ErrorOr<GamingPackageResponse>> Handle(CreatePackageCommand request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Error.Unauthorized("Gaming.NoTenant", "Tenant context is required.");
        }

        GamingPackage package = GamingPackage.Create(
            tenantId, request.BranchId, request.Name, request.DurationMinutes, request.Price, request.StationType);
        db.GamingPackages.Add(package);
        await db.SaveChangesAsync(cancellationToken);
        return PackageMapper.ToResponse(package);
    }
}

internal sealed class DeletePackageCommandHandler(GamingDbContext db) : ICommandHandler<DeletePackageCommand, Success>
{
    // Deactivated rather than deleted: past sessions keep their package snapshot either way.
    public async Task<ErrorOr<Success>> Handle(DeletePackageCommand request, CancellationToken cancellationToken)
    {
        GamingPackage? package = await db.GamingPackages
            .FirstOrDefaultAsync(p => p.Id == request.PackageId && p.BranchId == request.BranchId, cancellationToken);
        if (package is null)
        {
            return GamingErrors.PackageNotFound;
        }

        package.Deactivate();
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
