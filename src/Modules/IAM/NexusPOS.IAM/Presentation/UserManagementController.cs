using System.Security.Claims;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.IAM.Application.Commands.CreateUser;
using NexusPOS.IAM.Application.Commands.DeleteUser;
using NexusPOS.IAM.Application.Common;
using NexusPOS.IAM.Application.Queries.ListUsers;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.IAM.Presentation;

[ApiController]
[Route("api/v1/users")]
[Produces("application/json")]
[Authorize(Policy = "TenantUser")]
public sealed class UserManagementController(ISender mediator) : ControllerBase
{
    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id") ?? Guid.Empty.ToString());
    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    /// <summary>قائمة مستخدمي المستأجر</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<UserSummaryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListUsers(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ListUsersQuery(TenantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>إنشاء مستخدم جديد للمستأجر</summary>
    [HttpPost]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(UserSummaryResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateUser(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateUserCommand(TenantId, request.Email, request.FirstName, request.LastName, request.Password, request.Role);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(user => CreatedAtAction(nameof(ListUsers), user), MapErrors);
    }

    /// <summary>حذف مستخدم من المستأجر</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new DeleteUserCommand(id, CurrentUserId, TenantId), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    private IActionResult MapErrors(List<Error> errors) => this.ToProblem(errors);
}

public sealed record CreateUserRequest(string Email, string FirstName, string LastName, string Password, string Role);
