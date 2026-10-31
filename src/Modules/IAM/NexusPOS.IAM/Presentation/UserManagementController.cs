using System.Security.Claims;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.IAM.Application.Commands.CreateUser;
using NexusPOS.IAM.Application.Commands.DeleteUser;
using NexusPOS.IAM.Application.Commands.ResetUserPassword;
using NexusPOS.IAM.Application.Commands.SetUserActive;
using NexusPOS.IAM.Application.Commands.UpdateUser;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Application.Queries.ListUsers;

namespace NexusPOS.IAM.Presentation;

[ApiController]
[Route("api/v1/users")]
[Produces("application/json")]
[Authorize(Policy = "OwnerOrManager")]
public sealed class UserManagementController(ISender mediator) : ControllerBase
{
    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id") ?? Guid.Empty.ToString());
    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
    private List<string> CallerRoles => [.. User.FindAll(ClaimTypes.Role).Select(c => c.Value)];

    /// <summary>قائمة مستخدمي المستأجر (للمالك والمدير فقط، فيها بريد كل الموظفين)</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<UserSummaryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListUsers(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ListUsersQuery(TenantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إنشاء مستخدم جديد للمستأجر</summary>
    [HttpPost]
    [ProducesResponseType(typeof(UserSummaryResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateUser(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateUserCommand(TenantId, request.Email, request.FirstName, request.LastName, request.Password, request.Role, CallerRoles, CurrentUserId);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(user => CreatedAtAction(nameof(ListUsers), user), MapErrors);
    }

    /// <summary>تعديل اسم المستخدم ودوره</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(UserSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUser(
        Guid id,
        [FromBody] UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        var command = new UpdateUserCommand(TenantId, id, CurrentUserId, CallerRoles, request.FirstName, request.LastName, request.Role);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إيقاف حساب مستخدم (يسجّل خروجه من كل الأجهزة)</summary>
    [HttpPost("{id:guid}/deactivate")]
    [ProducesResponseType(typeof(UserSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SetUserActiveCommand(TenantId, id, CurrentUserId, CallerRoles, false), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إعادة تفعيل حساب مستخدم موقوف</summary>
    [HttpPost("{id:guid}/activate")]
    [ProducesResponseType(typeof(UserSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ActivateUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SetUserActiveCommand(TenantId, id, CurrentUserId, CallerRoles, true), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>تعيين كلمة مرور جديدة لمستخدم (يسجّل خروجه من كل الأجهزة)</summary>
    [HttpPost("{id:guid}/reset-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ResetPassword(
        Guid id,
        [FromBody] ResetUserPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var command = new ResetUserPasswordCommand(TenantId, id, CurrentUserId, CallerRoles, request.NewPassword);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    /// <summary>
    /// إزالة مستخدم: توقف الحساب افتراضياً. permanent=true يحذفه نهائياً فقط إذا لم يسجّل دخول أبداً.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteUser(
        Guid id,
        [FromQuery] bool permanent = false,
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new DeleteUserCommand(id, CurrentUserId, TenantId, CallerRoles, permanent), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    private IActionResult MapErrors(List<Error> errors)
    {
        if (errors.TrueForAll(e => e.Type == ErrorType.Validation))
        {
            ValidationProblemDetails pd = new();
            foreach (Error error in errors)
            {
                pd.Errors[error.Code] = [error.Description];
            }
            return ValidationProblem(pd);
        }

        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status500InternalServerError,
        };
        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}

public sealed record CreateUserRequest(string Email, string FirstName, string LastName, string Password, string Role);

public sealed record UpdateUserRequest(string FirstName, string LastName, string Role);

public sealed record ResetUserPasswordRequest(string NewPassword);
