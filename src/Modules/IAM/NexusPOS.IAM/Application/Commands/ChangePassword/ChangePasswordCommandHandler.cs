using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.ChangePassword;

internal sealed class ChangePasswordCommandHandler(IamDbContext db, IPasswordService passwordService)
    : ICommandHandler<ChangePasswordCommand>
{
    public async Task<ErrorOr<Success>> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        User? user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == new UserId(request.UserId), cancellationToken);

        if (user is null)
        {
            return Error.NotFound("User.NotFound", "المستخدم غير موجود");
        }

        if (user.PasswordHash is null || !passwordService.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            return Error.Validation("User.WrongPassword", "كلمة المرور الحالية غير صحيحة");
        }

        user.ChangePassword(passwordService.HashPassword(request.NewPassword));
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
