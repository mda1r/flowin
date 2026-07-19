using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.UpdateProfile;

internal sealed class UpdateProfileCommandHandler(IamDbContext db)
    : ICommandHandler<UpdateProfileCommand>
{
    public async Task<ErrorOr<Success>> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
    {
        User? user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == new UserId(request.UserId), cancellationToken);

        if (user is null)
        {
            return Error.NotFound("User.NotFound", "المستخدم غير موجود");
        }

        user.UpdateProfile(request.FirstName, request.LastName);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
