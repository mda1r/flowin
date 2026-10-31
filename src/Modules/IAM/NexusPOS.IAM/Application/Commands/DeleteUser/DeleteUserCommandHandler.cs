using ErrorOr;
using MediatR;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.DeleteUser;

internal sealed class DeleteUserCommandHandler(IamDbContext db, IPublisher publisher)
    : ICommandHandler<DeleteUserCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        DeleteUserCommand request,
        CancellationToken cancellationToken)
    {
        if (request.UserId == request.CurrentUserId)
        {
            return Error.Forbidden("User.CannotDeleteSelf", "لا يمكنك حذف حسابك الشخصي");
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

        int activeOwners = await db.CountActiveOwnersAsync(request.TenantId, cancellationToken);
        ErrorOr<Success> lastOwner = UserManagementRules.EnsureNotLastOwner(user.Roles, user.IsActive, activeOwners);
        if (lastOwner.IsError)
        {
            return lastOwner.Errors;
        }

        if (request.Permanent)
        {
            // Someone who has signed in may own shifts, orders and log entries; keep the row.
            if (user.LastLoginAt is not null)
            {
                return Error.Conflict("User.HasHistory", "هذا المستخدم له سجل عمل، يمكنك إيقافه بدل حذفه");
            }

            await publisher.PublishStaffChangeAsync(
                db, request.TenantId, request.CurrentUserId, StaffAudit.Deleted, StaffAudit.Describe(user), cancellationToken);
            db.Users.Remove(user);
        }
        else
        {
            if (user.IsActive)
            {
                await publisher.PublishStaffChangeAsync(
                    db, request.TenantId, request.CurrentUserId, StaffAudit.Deactivated, StaffAudit.Describe(user), cancellationToken);
            }

            user.Deactivate();
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
