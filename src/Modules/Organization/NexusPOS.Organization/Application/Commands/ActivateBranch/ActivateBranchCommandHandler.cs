using ErrorOr;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.ActivateBranch;

internal sealed class ActivateBranchCommandHandler(
    IBranchRepository branchRepository,
    OrganizationDbContext dbContext)
    : ICommandHandler<ActivateBranchCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        ActivateBranchCommand request,
        CancellationToken cancellationToken)
    {
        Branch? branch = await branchRepository.FindByIdAsync(
            new BranchId(request.BranchId), cancellationToken);

        if (branch is null || branch.TenantId.Value != request.TenantId)
        {
            return OrganizationErrors.BranchNotFound;
        }

        if (branch.IsActive)
        {
            return Result.Success;
        }

        branch.Activate();

        branchRepository.Update(branch);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
