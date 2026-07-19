using ErrorOr;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Queries.ListSubscriptionPlans;

internal sealed class ListSubscriptionPlansQueryHandler(ISubscriptionPlanRepository repository)
    : IQueryHandler<ListSubscriptionPlansQuery, List<SubscriptionPlanResponse>>
{
    public async Task<ErrorOr<List<SubscriptionPlanResponse>>> Handle(
        ListSubscriptionPlansQuery request,
        CancellationToken cancellationToken)
    {
        var plans = await repository.GetAllAsync(cancellationToken);

        return plans.Select(p => new SubscriptionPlanResponse(
            p.Id,
            p.Name,
            p.BusinessType,
            p.Price,
            p.MaxBranches,
            p.MaxUsers,
            p.Features,
            p.IsActive,
            p.CreatedAt)).ToList();
    }
}
