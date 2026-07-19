using ErrorOr;

namespace NexusPOS.IAM.Domain;

public static class IamErrors
{
    public static readonly Error UserNotFound =
        Error.NotFound("IAM.UserNotFound", "User was not found.");

    public static readonly Error EmailAlreadyExists =
        Error.Conflict("IAM.EmailAlreadyExists", "A user with this email already exists.");

    public static readonly Error InvalidCredentials =
        Error.Unauthorized("IAM.InvalidCredentials", "Invalid email or password.");

    public static readonly Error AccountLocked =
        Error.Forbidden("IAM.AccountLocked", "Account is temporarily locked due to multiple failed login attempts.");

    public static readonly Error InvalidRefreshToken =
        Error.Unauthorized("IAM.InvalidRefreshToken", "The refresh token is invalid or has been revoked.");

    public static readonly Error RefreshTokenExpired =
        Error.Unauthorized("IAM.RefreshTokenExpired", "The refresh token has expired.");

    public static readonly Error UserInactive =
        Error.Forbidden("IAM.UserInactive", "This account has been deactivated.");

    public static readonly Error TooManyRequests =
        Error.Custom(429, "IAM.TooManyRequests", "Too many requests. Please try again later.");
}
