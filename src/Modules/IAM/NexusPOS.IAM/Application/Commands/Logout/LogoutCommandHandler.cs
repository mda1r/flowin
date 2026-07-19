using ErrorOr;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.IAM.Infrastructure.Persistence;

namespace NexusPOS.IAM.Application.Commands.Logout;

internal sealed class LogoutCommandHandler(
    IUserRepository userRepository,
    IamDbContext dbContext)
    : ICommandHandler<LogoutCommand, LogoutResponse>
{
    public async Task<ErrorOr<LogoutResponse>> Handle(
        LogoutCommand request,
        CancellationToken cancellationToken)
    {
        User? user = await userRepository.FindByRefreshTokenAsync(request.RefreshToken, cancellationToken);
        if (user is null)
        {
            return IamErrors.InvalidRefreshToken;
        }

        if (request.LogoutAllDevices)
        {
            user.RevokeAllRefreshTokens();
        }
        else
        {
            user.RevokeRefreshToken(request.RefreshToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new LogoutResponse(true);
    }
}
