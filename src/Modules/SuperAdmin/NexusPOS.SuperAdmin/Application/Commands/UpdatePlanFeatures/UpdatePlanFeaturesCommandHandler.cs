using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Repositories;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.UpdatePlanFeatures;

internal sealed class UpdatePlanFeaturesCommandHandler(
    ISubscriptionPlanRepository repository,
    SuperAdminDbContext dbContext)
    : ICommandHandler<UpdatePlanFeaturesCommand, SubscriptionPlanResponse>
{
    public async Task<ErrorOr<SubscriptionPlanResponse>> Handle(
        UpdatePlanFeaturesCommand request,
        CancellationToken cancellationToken)
    {
        SubscriptionPlan? plan = await repository.GetByIdAsync(request.PlanId, cancellationToken);

        if (plan is null)
        {
            return Error.NotFound("Plan.NotFound", "Subscription plan not found.");
        }

        plan.UpdateFeatures(request.Features);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new SubscriptionPlanResponse(
            plan.Id,
            plan.Name,
            plan.BusinessType,
            plan.Price,
            plan.MaxBranches,
            plan.MaxUsers,
            plan.Features,
            plan.IsActive,
            plan.CreatedAt);
    }
}
