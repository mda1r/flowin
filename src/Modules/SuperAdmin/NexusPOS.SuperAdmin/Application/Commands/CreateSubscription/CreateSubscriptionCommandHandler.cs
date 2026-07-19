using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Repositories;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateSubscription;

internal sealed class CreateSubscriptionCommandHandler(
    OrganizationDbContext orgDb,
    ISubscriptionPlanRepository planRepository,
    ITenantSubscriptionRepository subscriptionRepository,
    SuperAdminDbContext dbContext)
    : ICommandHandler<CreateSubscriptionCommand, TenantSubscriptionResponse>
{
    public async Task<ErrorOr<TenantSubscriptionResponse>> Handle(
        CreateSubscriptionCommand request,
        CancellationToken cancellationToken)
    {
        bool tenantExists = await orgDb.Tenants
            .AnyAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (!tenantExists)
        {
            return Error.NotFound("Tenant.NotFound", "المستأجر غير موجود");
        }

        SubscriptionPlan? plan = await planRepository.GetByIdAsync(request.PlanId, cancellationToken);
        if (plan is null)
        {
            return Error.NotFound("Plan.NotFound", "خطة الاشتراك غير موجودة");
        }

        TenantSubscription subscription = TenantSubscription.Create(
            request.TenantId,
            request.PlanId,
            request.StartDate,
            request.ExpiryDate,
            plan.MaxBranches,
            plan.MaxUsers,
            request.Notes);

        subscriptionRepository.Add(subscription);
        await dbContext.SaveChangesAsync(cancellationToken);

        int daysRemaining = (int)(subscription.ExpiryDate - DateTime.UtcNow).TotalDays;

        return new TenantSubscriptionResponse(
            subscription.Id,
            subscription.TenantId,
            subscription.PlanId,
            plan.Name,
            plan.Price,
            subscription.StartDate,
            subscription.ExpiryDate,
            subscription.Status,
            subscription.MaxBranches,
            subscription.MaxUsers,
            subscription.Notes,
            subscription.CreatedAt,
            daysRemaining);
    }
}
