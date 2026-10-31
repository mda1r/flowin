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

namespace NexusPOS.SuperAdmin.Application.Commands.RenewSubscription;

internal sealed class RenewSubscriptionCommandHandler(
    OrganizationDbContext orgDb,
    ITenantSubscriptionRepository subscriptionRepository,
    SuperAdminDbContext dbContext)
    : ICommandHandler<RenewSubscriptionCommand, TenantSubscriptionResponse>
{
    public async Task<ErrorOr<TenantSubscriptionResponse>> Handle(
        RenewSubscriptionCommand request,
        CancellationToken cancellationToken)
    {
        var tenant = await orgDb.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "المستأجر غير موجود");
        }

        List<TenantSubscription> subscriptions = await subscriptionRepository.GetByTenantIdAsync(request.TenantId, cancellationToken);
        TenantSubscription? latest = request.SubscriptionId is { } shownId
            ? subscriptions.FirstOrDefault(s => s.Id == shownId && s.Status != SubscriptionStatus.Cancelled)
            : TenantSubscription.PickRenewable(subscriptions);

        if (latest is null)
        {
            return Error.NotFound("Subscription.NotFound", "لا يوجد اشتراك لتجديده، أنشئ اشتراكاً جديداً");
        }

        // The admin priced the subscription they were shown; never extend a different one.
        if (subscriptions.Any(s => s.Status != SubscriptionStatus.Cancelled && s.ExpiryDate > latest.ExpiryDate))
        {
            return Error.Conflict("Subscription.NotLatest", "يوجد اشتراك لاحق، جدّده بدلاً من هذا");
        }

        DateTime now = DateTime.UtcNow;
        TenantSubscription renewed;

        if (latest.ExpiryDate >= now)
        {
            // Still running (or pre-paid): push the end of the chain out by the paid months.
            latest.Extend(request.Months, now);
            renewed = latest;
        }
        else
        {
            // Already over: start a fresh period from today so the history keeps the unpaid gap visible.
            SubscriptionPlan? plan = latest.Plan;
            renewed = TenantSubscription.Create(
                request.TenantId,
                latest.PlanId,
                now,
                now.AddMonths(request.Months),
                plan?.MaxBranches ?? latest.MaxBranches,
                plan?.MaxUsers ?? latest.MaxUsers,
                RenewalNote(request.Months));

            if (!tenant.IsActive)
            {
                renewed.Suspend();
            }

            subscriptionRepository.Add(renewed);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return renewed.ToResponse(now, latest.Plan);
    }

    private static string RenewalNote(int months) => months switch
    {
        1 => "تجديد شهر",
        2 => "تجديد شهرين",
        <= 10 => $"تجديد {months} أشهر",
        _ => $"تجديد {months} شهراً",
    };
}
