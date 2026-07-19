using ErrorOr;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Queries.GetBranchById;

internal sealed class GetBranchByIdQueryHandler(IBranchRepository branchRepository)
    : IQueryHandler<GetBranchByIdQuery, BranchResponse>
{
    public async Task<ErrorOr<BranchResponse>> Handle(
        GetBranchByIdQuery request,
        CancellationToken cancellationToken)
    {
        Branch? branch = await branchRepository.FindByIdAsync(
            new BranchId(request.BranchId), cancellationToken);

        if (branch is null || branch.TenantId.Value != request.TenantId)
        {
            return OrganizationErrors.BranchNotFound;
        }

        return new BranchResponse(
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
}
