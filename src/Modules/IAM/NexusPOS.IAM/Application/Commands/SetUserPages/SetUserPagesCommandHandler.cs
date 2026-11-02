using ErrorOr;
using MediatR;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.SetUserPages;

internal sealed class SetUserPagesCommandHandler(IamDbContext db, IPublisher publisher)
    : ICommandHandler<SetUserPagesCommand, UserSummaryResponse>
{
    public async Task<ErrorOr<UserSummaryResponse>> Handle(
        SetUserPagesCommand request,
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

        user.SetAllowedPages(request.Pages);

        string pages = user.AllowedPages is null ? "كل الصفحات" : string.Join("، ", user.AllowedPages);
        await publisher.PublishStaffChangeAsync(
            db, request.TenantId, request.CurrentUserId,
            StaffAudit.PagesChanged, $"{StaffAudit.Describe(user)}: {pages}", cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return user.ToSummary();
    }
}
