using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.IAM.Application.Commands.SetUserActive;

internal sealed class SetUserActiveCommandHandler(
    IamDbContext db,
    ITenantSubscriptionChecker subscriptionChecker)
    : ICommandHandler<SetUserActiveCommand, UserSummaryResponse>
{
    public async Task<ErrorOr<UserSummaryResponse>> Handle(
        SetUserActiveCommand request,
        CancellationToken cancellationToken)
    {
        if (request.UserId == request.CurrentUserId)
        {
            return UserManagementRules.CannotManageSelf;
        }

        User? user = await db.FindTenantUserAsync(request.TenantId, request.UserId, cancellationToken);
        if (user is null)
        {
            return Error.NotFound("User.NotFound", "المستخدم غير موجود");
        }

        ErrorOr<Success> canManage = UserManagementRules.CanManage(request.CallerRoles, user.Roles);
        if (canManage.IsError)
        {
            return canManage.Errors;
        }

        if (user.IsActive == request.IsActive)
        {
            return user.ToSummary();
        }

        if (request.IsActive)
        {
            // Reactivating counts against the plan's user limit just like creating.
            int activeCount = await db.Users.CountAsync(
                u => u.TenantId == request.TenantId && u.IsActive, cancellationToken);
            int? maxUsers = await subscriptionChecker.GetMaxUsersAsync(request.TenantId, cancellationToken);
            if (maxUsers.HasValue && activeCount >= maxUsers.Value)
            {
                return Error.Forbidden(
                    "User.LimitReached",
                    $"وصلت للحد الأقصى للمستخدمين ({maxUsers.Value}). ترقية الاشتراك مطلوبة.");
            }

            user.Activate();
        }
        else
        {
            int activeOwners = await db.CountActiveOwnersAsync(request.TenantId, cancellationToken);
            ErrorOr<Success> lastOwner = UserManagementRules.EnsureNotLastOwner(user.Roles, user.IsActive, activeOwners);
            if (lastOwner.IsError)
            {
                return lastOwner.Errors;
            }

            user.Deactivate();
        }

        await db.SaveChangesAsync(cancellationToken);
        return user.ToSummary();
    }
}
