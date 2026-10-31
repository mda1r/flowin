using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.DeleteUser;

internal sealed class DeleteUserCommandHandler(IamDbContext db)
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

        var userId = new UserId(request.UserId);
        User? user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == request.TenantId, cancellationToken);

        if (user is null)
        {
            return Error.NotFound("User.NotFound", "المستخدم غير موجود");
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
