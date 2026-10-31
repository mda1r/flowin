using ErrorOr;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Organization.Infrastructure.Persistence;

namespace NexusPOS.Organization.Application.Commands.UpdateBranch;

internal sealed class UpdateBranchCommandHandler(
    IBranchRepository branchRepository,
    OrganizationDbContext dbContext)
    : ICommandHandler<UpdateBranchCommand, BranchResponse>
{
    public async Task<ErrorOr<BranchResponse>> Handle(
        UpdateBranchCommand request,
        CancellationToken cancellationToken)
    {
        Branch? branch = await branchRepository.FindByIdAsync(
            new BranchId(request.BranchId), cancellationToken);

        if (branch is null)
        {
            return OrganizationErrors.BranchNotFound;
        }

        if (branch.TenantId.Value != request.TenantId)
        {
            return OrganizationErrors.BranchNotFound;
        }

        Address? address = BuildAddress(request);
        branch.Update(request.Name, request.Type, address, request.PhoneNumber, request.Email);

        branchRepository.Update(branch);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(branch);
    }

    private static Address? BuildAddress(UpdateBranchCommand request)
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
