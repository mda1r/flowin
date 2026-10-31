using ErrorOr;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Organization.Infrastructure.Persistence;

namespace NexusPOS.Organization.Application.Commands.DeactivateBranch;

internal sealed class DeactivateBranchCommandHandler(
    IBranchRepository branchRepository,
    OrganizationDbContext dbContext)
    : ICommandHandler<DeactivateBranchCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        DeactivateBranchCommand request,
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

        if (!branch.IsActive)
        {
            return Result.Success;
        }

        branch.Deactivate();

        branchRepository.Update(branch);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
