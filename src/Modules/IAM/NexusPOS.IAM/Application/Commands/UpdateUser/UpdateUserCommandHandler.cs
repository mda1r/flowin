using ErrorOr;
using MediatR;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.UpdateUser;

internal sealed class UpdateUserCommandHandler(IamDbContext db, IPublisher publisher)
    : ICommandHandler<UpdateUserCommand, UserSummaryResponse>
{
    public async Task<ErrorOr<UserSummaryResponse>> Handle(
        UpdateUserCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<UserRole> roleResult = UserManagementRules.ParseAssignableRole(request.Role);
        if (roleResult.IsError)
        {
            return roleResult.Errors;
        }
        UserRole newRole = roleResult.Value;

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

        UserRole oldRole = user.Roles.Count > 0 ? user.Roles.Min() : newRole;
        bool roleChanged = user.Roles.Count != 1 || user.Roles[0] != newRole;
        if (roleChanged)
        {
            // Changing your own role is how admins lock themselves out; another admin must do it.
            if (request.UserId == request.CurrentUserId)
            {
                return UserManagementRules.CannotManageSelf;
            }

            ErrorOr<Success> canAssign = UserManagementRules.CanAssign(request.CallerRoles, newRole);
            if (canAssign.IsError)
            {
                return canAssign.Errors;
            }

            if (newRole != UserRole.Owner)
            {
                int activeOwners = await db.CountActiveOwnersAsync(request.TenantId, cancellationToken);
                ErrorOr<Success> lastOwner = UserManagementRules.EnsureNotLastOwner(user.Roles, user.IsActive, activeOwners);
                if (lastOwner.IsError)
                {
                    return lastOwner.Errors;
                }
            }

            user.SetRole(newRole);
        }

        string firstName = request.FirstName.Trim();
        string lastName = request.LastName.Trim();
        bool nameChanged = firstName != user.FirstName || lastName != user.LastName;
        user.UpdateProfile(firstName, lastName);

        if (roleChanged)
        {
            await publisher.PublishStaffChangeAsync(
                db, request.TenantId, request.CurrentUserId, StaffAudit.RoleChanged,
                $"{user.FullName}: {StaffAudit.RoleLabel(oldRole)} ← {StaffAudit.RoleLabel(newRole)}", cancellationToken);
        }
        else if (nameChanged)
        {
            await publisher.PublishStaffChangeAsync(
                db, request.TenantId, request.CurrentUserId, StaffAudit.Edited, user.FullName, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);

        return user.ToSummary();
    }
}
