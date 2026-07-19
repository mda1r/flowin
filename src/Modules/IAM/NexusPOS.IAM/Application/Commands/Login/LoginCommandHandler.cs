using ErrorOr;
using Microsoft.Extensions.Configuration;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Repositories;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.IAM.Infrastructure.Persistence;

namespace NexusPOS.IAM.Application.Commands.Login;

internal sealed class LoginCommandHandler(
    IUserRepository userRepository,
    IPasswordService passwordService,
    IJwtService jwtService,
    IConfiguration configuration,
    ITenantContextResolver tenantContextResolver,
    IamDbContext dbContext)
    : ICommandHandler<LoginCommand, TokenResponse>
{
    public async Task<ErrorOr<TokenResponse>> Handle(
        LoginCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<Email> emailResult = Email.Create(request.Email);
        if (emailResult.IsError)
        {
            return IamErrors.InvalidCredentials;
        }

        User? user = await userRepository.FindByEmailAsync(emailResult.Value, cancellationToken);
        if (user is null)
        {
            return IamErrors.InvalidCredentials;
        }

        if (!user.IsActive)
        {
            return IamErrors.UserInactive;
        }

        if (user.IsLockedOut)
        {
            return IamErrors.AccountLocked;
        }

        if (user.PasswordHash is null || !passwordService.VerifyPassword(request.Password, user.PasswordHash))
        {
            user.RecordFailedLogin();
            await dbContext.SaveChangesAsync(cancellationToken);
            return IamErrors.InvalidCredentials;
        }

        int refreshExpiryDays = configuration.GetValue("Jwt:RefreshTokenExpiryDays", 7);
        RefreshToken refreshToken = user.CreateRefreshToken(refreshExpiryDays, request.DeviceInfo);
        dbContext.RefreshTokens.Add(refreshToken);  // explicitly mark as Added before DetectChanges runs
        user.RecordSuccessfulLogin();

        TenantContext? tenantCtx = await tenantContextResolver.ResolveAsync(user.TenantId, user.Email.Value, cancellationToken);
        Guid? tenantId = tenantCtx?.TenantId ?? configuration.GetValue<Guid?>("Demo:TenantId");
        Guid? branchId = tenantCtx?.BranchId ?? configuration.GetValue<Guid?>("Demo:BranchId");
        string? businessType = tenantCtx?.BusinessType ?? configuration.GetValue<string?>("Demo:BusinessType");
        string accessToken = jwtService.GenerateAccessToken(user.Id, user.Email, user.FirstName, user.LastName, user.Roles, tenantId, branchId, businessType);
        int accessTokenExpiryMinutes = configuration.GetValue("Jwt:AccessTokenExpiryMinutes", 15);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new TokenResponse(
            accessToken,
            refreshToken.Token,
            DateTime.UtcNow.AddMinutes(accessTokenExpiryMinutes),
            refreshToken.ExpiresAt);
    }
}
