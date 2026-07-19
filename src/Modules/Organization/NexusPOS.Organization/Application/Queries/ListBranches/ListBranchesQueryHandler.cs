using ErrorOr;
using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Queries.ListBranches;

internal sealed class ListBranchesQueryHandler(IBranchRepository branchRepository)
    : IQueryHandler<ListBranchesQuery, IReadOnlyList<BranchResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<BranchResponse>>> Handle(
        ListBranchesQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Branch> branches = await branchRepository.FindByTenantIdAsync(
            new TenantId(request.TenantId), cancellationToken);

        IReadOnlyList<BranchResponse> responses = branches.Select(MapToResponse).ToList();

        return ErrorOrFactory.From(responses);
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
