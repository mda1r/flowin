using ErrorOr;
using NexusPOS.Organization.Domain;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.SetMainBranch;

// Moves the main-branch flag to the given branch; every other branch of the tenant loses it in the same save.
internal sealed class SetMainBranchCommandHandler(
    IBranchRepository branchRepository,
    OrganizationDbContext dbContext)
    : ICommandHandler<SetMainBranchCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        SetMainBranchCommand request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Branch> branches = await branchRepository.FindByTenantIdAsync(
            new TenantId(request.TenantId), cancellationToken);

        Branch? target = branches.FirstOrDefault(b => b.Id.Value == request.BranchId);
        if (target is null)
        {
            return OrganizationErrors.BranchNotFound;
        }

        if (!target.IsActive)
        {
            return OrganizationErrors.MainBranchMustBeActive;
        }

        if (target.IsMainBranch && branches.Count(b => b.IsMainBranch) == 1)
        {
            return Result.Success;
        }

        foreach (Branch other in branches.Where(b => b.IsMainBranch && b.Id != target.Id))
        {
            other.UnmarkAsMain();
        }

        target.MarkAsMain();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
