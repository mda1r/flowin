using ErrorOr;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Organization.Infrastructure.Persistence;

namespace NexusPOS.Organization.Application.Commands.CreateBranch;

internal sealed class CreateBranchCommandHandler(
    ITenantRepository tenantRepository,
    IBranchRepository branchRepository,
    OrganizationDbContext dbContext)
    : ICommandHandler<CreateBranchCommand, BranchResponse>
{
    public async Task<ErrorOr<BranchResponse>> Handle(
        CreateBranchCommand request,
        CancellationToken cancellationToken)
    {
        TenantId tenantId = new(request.TenantId);

        Tenant? tenant = await tenantRepository.FindByIdAsync(tenantId, cancellationToken);
        if (tenant is null)
        {
            return OrganizationErrors.TenantNotFound;
        }

        if (!tenant.IsActive)
        {
            return OrganizationErrors.TenantSuspended;
        }

        bool nameExists = await branchRepository.ExistsByNameAsync(
            tenantId, request.Name, cancellationToken);
        if (nameExists)
        {
            return OrganizationErrors.BranchAlreadyExists;
        }

        Branch branch = Branch.Create(tenantId, request.Name, request.Type, request.IsMainBranch);

        Address? address = BuildAddress(request);
        if (address is not null || request.PhoneNumber is not null || request.Email is not null)
        {
            branch.Update(request.Name, request.Type, address, request.PhoneNumber, request.Email);
        }

        branchRepository.Add(branch);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(branch);
    }

    private static Address? BuildAddress(CreateBranchCommand request)
    {
        if (request.Street is null && request.City is null &&
            request.State is null && request.Country is null &&
            request.PostalCode is null)
        {
            return null;
        }

        return Address.Create(
            request.Street ?? string.Empty,
            request.City ?? string.Empty,
            request.State,
            request.Country ?? string.Empty,
            request.PostalCode);
    }

    private static BranchResponse MapToResponse(Branch branch) => new(
        branch.Id.Value,
        branch.TenantId.Value,
        branch.Name,
        branch.Type,
        branch.IsActive,
        branch.IsMainBranch,
        branch.CreatedAt,
        branch.PhoneNumber,
        branch.Email,
        branch.Address?.Street,
        branch.Address?.City,
        branch.Address?.State,
        branch.Address?.Country,
        branch.Address?.PostalCode);
}
