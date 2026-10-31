using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Enums;
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
        var tenant = await orgDb.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "المستأجر غير موجود");
        }

        SubscriptionPlan? plan = await planRepository.GetByIdAsync(request.PlanId, cancellationToken);
        if (plan is null)
        {
            return Error.NotFound("Plan.NotFound", "خطة الاشتراك غير موجودة");
        }

        // The new subscription replaces whatever overlaps it (e.g. a plan change mid-term):
        // the old one ends where the new one starts, so a tenant never has two live subscriptions.
        List<TenantSubscription> existing = await subscriptionRepository.GetByTenantIdAsync(request.TenantId, cancellationToken);
        foreach (TenantSubscription overlapping in existing.Where(s =>
            s.Status is SubscriptionStatus.Active or SubscriptionStatus.Trial or SubscriptionStatus.Suspended
            && s.StartDate < request.ExpiryDate
            && s.ExpiryDate > request.StartDate))
        {
            overlapping.EndAt(request.StartDate);
        }

        TenantSubscription subscription = TenantSubscription.Create(
            request.TenantId,
            request.PlanId,
            request.StartDate,
            request.ExpiryDate,
            plan.MaxBranches,
            plan.MaxUsers,
            request.Notes);

        // A suspended tenant's new subscription waits for reactivation like the rest.
        if (!tenant.IsActive)
        {
            subscription.Suspend();
        }

        subscriptionRepository.Add(subscription);
        await dbContext.SaveChangesAsync(cancellationToken);

        return subscription.ToResponse(DateTime.UtcNow, plan);
    }
}
