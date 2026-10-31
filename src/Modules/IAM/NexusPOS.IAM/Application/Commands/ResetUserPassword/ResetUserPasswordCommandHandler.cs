using ErrorOr;
using MediatR;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.ResetUserPassword;

internal sealed class ResetUserPasswordCommandHandler(
    IamDbContext db,
    IPasswordService passwordService,
    IPublisher publisher)
    : ICommandHandler<ResetUserPasswordCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        ResetUserPasswordCommand request,
        CancellationToken cancellationToken)
    {
        // Your own password goes through change-password, which checks the current one.
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

        user.ResetPassword(passwordService.HashPassword(request.NewPassword));
        await publisher.PublishStaffChangeAsync(
            db, request.TenantId, request.CurrentUserId, StaffAudit.PasswordReset, StaffAudit.Describe(user), cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
