using ErrorOr;
using Microsoft.Extensions.Configuration;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.IAM.Infrastructure.Persistence;

namespace NexusPOS.IAM.Application.Commands.Refresh;

internal sealed class RefreshTokenCommandHandler(
    IUserRepository userRepository,
    IJwtService jwtService,
    IConfiguration configuration,
    ITenantContextResolver tenantContextResolver,
    IamDbContext dbContext)
    : ICommandHandler<RefreshTokenCommand, TokenResponse>
{
    public async Task<ErrorOr<TokenResponse>> Handle(
        RefreshTokenCommand request,
        CancellationToken cancellationToken)
    {
        User? user = await userRepository.FindByRefreshTokenAsync(request.Token, cancellationToken);
        if (user is null)
        {
            return IamErrors.InvalidRefreshToken;
        }

        RefreshToken? existingToken = user.RefreshTokens
            .FirstOrDefault(t => t.Token == request.Token);

        if (existingToken is null || !existingToken.IsActive)
        {
            return existingToken?.IsExpired == true
                ? IamErrors.RefreshTokenExpired
                : IamErrors.InvalidRefreshToken;
        }

        if (!user.IsActive)
        {
            return IamErrors.UserInactive;
        }

        existingToken.Revoke();

        int refreshExpiryDays = configuration.GetValue("Jwt:RefreshTokenExpiryDays", 7);
        RefreshToken newRefreshToken = user.CreateRefreshToken(refreshExpiryDays, existingToken.DeviceInfo);
        dbContext.RefreshTokens.Add(newRefreshToken);

        TenantContext? tenantCtx = await tenantContextResolver.ResolveAsync(user.TenantId, user.Email.Value, cancellationToken);
        Guid? tenantId = tenantCtx?.TenantId ?? configuration.GetValue<Guid?>("Demo:TenantId");
        Guid? branchId = tenantCtx?.BranchId ?? configuration.GetValue<Guid?>("Demo:BranchId");
        string? businessType = tenantCtx?.BusinessType ?? configuration.GetValue<string?>("Demo:BusinessType");
        string accessToken = jwtService.GenerateAccessToken(user.Id, user.Email, user.FirstName, user.LastName, user.Roles, tenantId, branchId, businessType);
        int accessTokenExpiryMinutes = configuration.GetValue("Jwt:AccessTokenExpiryMinutes", 15);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new TokenResponse(
            accessToken,
            newRefreshToken.Token,
            DateTime.UtcNow.AddMinutes(accessTokenExpiryMinutes),
            newRefreshToken.ExpiresAt);
    }
}
