using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NexusPOS.IAM.Application.Commands.ChangePassword;
using NexusPOS.IAM.Application.Commands.Login;
using NexusPOS.IAM.Application.Commands.Logout;
using NexusPOS.IAM.Application.Commands.Refresh;
using NexusPOS.IAM.Application.Commands.Register;
using NexusPOS.IAM.Application.Commands.UpdateProfile;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Application.Queries.GetAllowedPages;
using NexusPOS.IAM.Presentation.Requests;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.IAM.Presentation;

[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
public sealed class AuthController(ISender mediator) : ControllerBase
{
    /// <summary>Register a new user account.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthRateLimiting.RegisterPolicy)]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        RegisterCommand command = new(request.Email, request.Password, request.FirstName, request.LastName);
        ErrorOr<RegisterResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            response => CreatedAtAction(nameof(Register), new { id = response.UserId }, response),
            MapErrorsToResult);
    }

    /// <summary>Authenticate with email and password to obtain tokens.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthRateLimiting.LoginPolicy)]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        LoginCommand command = new(request.Email, request.Password, request.DeviceInfo);
        ErrorOr<TokenResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Exchange a refresh token for a new token pair.</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthRateLimiting.RefreshPolicy)]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        RefreshTokenCommand command = new(request.RefreshToken);
        ErrorOr<TokenResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Return the current authenticated user's profile from JWT claims.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(CurrentUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        string? id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        string? email = User.FindFirstValue(JwtRegisteredClaimNames.Email)
                        ?? User.FindFirstValue(ClaimTypes.Email);
        string? firstName = User.FindFirstValue(JwtRegisteredClaimNames.GivenName);
        string? lastName = User.FindFirstValue(JwtRegisteredClaimNames.FamilyName);
        // Users may have multiple roles; return the highest-privilege one
        string[] priorityOrder = ["SuperAdmin", "Owner", "Manager", "Accountant", "Cashier", "Staff"];
        IEnumerable<string> userRoles = User.FindAll(ClaimTypes.Role).Select(c => c.Value);
        string? role = priorityOrder.FirstOrDefault(r => userRoles.Contains(r));
        string? tenantId = User.FindFirstValue("tenant_id");
        string? branchId = User.FindFirstValue("branch_id");
        string? businessType = User.FindFirstValue("business_type");

        if (id is null || email is null)
        {
            return Unauthorized();
        }

        // Owners and managers always see every page; anyone else gets the list their owner set, read fresh.
        List<string>? allowedPages = null;
        if (role is not ("SuperAdmin" or "Owner" or "Manager")
            && Guid.TryParse(id, out Guid userId) && Guid.TryParse(tenantId, out Guid tenant))
        {
            ErrorOr<List<string>?> pages = await mediator.Send(new GetAllowedPagesQuery(userId, tenant), cancellationToken);
            allowedPages = pages.IsError ? null : pages.Value;
        }

        return Ok(new CurrentUserResponse(id, email, firstName ?? string.Empty, lastName ?? string.Empty, role ?? "Staff", tenantId, branchId, businessType, allowedPages));
    }

    /// <summary>Revoke this session (or every session of its user). The refresh token in the body is the
    /// credential, so this still works after the short-lived access token has expired.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthRateLimiting.RefreshPolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Logout(
        [FromBody] LogoutRequest request,
        CancellationToken cancellationToken)
    {
        LogoutCommand command = new(request.RefreshToken, request.LogoutAllDevices);
        ErrorOr<LogoutResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(_ => NoContent(), MapErrorsToResult);
    }

    /// <summary>Change the authenticated user's password.</summary>
    [HttpPatch("password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out Guid id))
        {
            return Unauthorized();
        }

        ChangePasswordCommand command = new(id, request.CurrentPassword, request.NewPassword);
        ErrorOr<Success> result = await mediator.Send(command, cancellationToken);
        return result.Match(_ => NoContent(), MapErrorsToResult);
    }

    /// <summary>Update the authenticated user's display name.</summary>
    [HttpPatch("profile")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out Guid id))
        {
            return Unauthorized();
        }

        UpdateProfileCommand command = new(id, request.FirstName, request.LastName);
        ErrorOr<Success> result = await mediator.Send(command, cancellationToken);
        return result.Match(_ => NoContent(), MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}
