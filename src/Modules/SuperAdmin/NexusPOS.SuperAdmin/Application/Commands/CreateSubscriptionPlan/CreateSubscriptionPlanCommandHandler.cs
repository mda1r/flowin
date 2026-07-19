using ErrorOr;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Repositories;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateSubscriptionPlan;

internal sealed class CreateSubscriptionPlanCommandHandler(
    ISubscriptionPlanRepository repository,
    SuperAdminDbContext dbContext)
    : ICommandHandler<CreateSubscriptionPlanCommand, SubscriptionPlanResponse>
{
    public async Task<ErrorOr<SubscriptionPlanResponse>> Handle(
        CreateSubscriptionPlanCommand request,
        CancellationToken cancellationToken)
    {
        SubscriptionPlan plan = SubscriptionPlan.Create(
            request.Name,
            request.Price,
            request.MaxBranches,
            request.MaxUsers,
            request.Features,
            request.BusinessType);

        repository.Add(plan);
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
