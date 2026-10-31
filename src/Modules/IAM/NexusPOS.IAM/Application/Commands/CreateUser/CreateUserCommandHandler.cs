using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.IAM.Application.Commands.CreateUser;

internal sealed class CreateUserCommandHandler(
    IamDbContext db,
    IPasswordService passwordService,
    ITenantSubscriptionChecker subscriptionChecker)
    : ICommandHandler<CreateUserCommand, UserSummaryResponse>
{
    public async Task<ErrorOr<UserSummaryResponse>> Handle(
        CreateUserCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<Email> emailResult = Email.Create(request.Email);
        if (emailResult.IsError)
        {
            return IamErrors.InvalidCredentials;
        }

        bool emailTaken = await db.Users.AnyAsync(
            u => u.Email.Value == emailResult.Value.Value, cancellationToken);

        if (emailTaken)
        {
            return Error.Conflict("User.EmailTaken", $"البريد الإلكتروني '{request.Email}' مستخدم بالفعل");
        }

        int currentCount = await db.Users.CountAsync(
            u => u.TenantId == request.TenantId && u.IsActive, cancellationToken);

        int? maxUsers = await subscriptionChecker.GetMaxUsersAsync(request.TenantId, cancellationToken);
        if (maxUsers.HasValue && currentCount >= maxUsers.Value)
        {
            return Error.Forbidden(
                "User.LimitReached",
                $"وصلت للحد الأقصى للمستخدمين ({maxUsers.Value}). ترقية الاشتراك مطلوبة.");
        }

        ErrorOr<UserRole> roleResult = UserManagementRules.ParseAssignableRole(request.Role);
        if (roleResult.IsError)
        {
            return roleResult.Errors;
        }
        UserRole role = roleResult.Value;

        // A Manager must not be able to mint an Owner account and take over the shop.
        ErrorOr<Success> canAssign = UserManagementRules.CanAssign(request.CallerRoles, role);
        if (canAssign.IsError)
        {
            return canAssign.Errors;
        }

        User user = User.Create(emailResult.Value, request.FirstName, request.LastName, request.TenantId);
        user.SetPassword(passwordService.HashPassword(request.Password));
        user.RemoveRole(UserRole.Staff);
        user.AddRole(role);
        user.VerifyEmail();
        user.ClearDomainEvents();

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        return user.ToSummary();
    }
}
