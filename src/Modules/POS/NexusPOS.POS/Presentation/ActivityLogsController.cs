using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.POS.Application.Commands.LogActivity;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Application.Queries.GetActivityLogs;
using NexusPOS.POS.Presentation.Requests;
using System.Security.Claims;

namespace NexusPOS.POS.Presentation;

[ApiController]
[Route("api/v1/activity-logs")]
[Produces("application/json")]
[Authorize]
public sealed class ActivityLogsController(ISender mediator) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    private string CurrentUserName
    {
        get
        {
            string first = User.FindFirstValue("given_name") ?? string.Empty;
            string last = User.FindFirstValue("family_name") ?? string.Empty;
            string full = $"{first} {last}".Trim();
            return string.IsNullOrEmpty(full)
                ? User.FindFirstValue(ClaimTypes.Email) ?? "مستخدم"
                : full;
        }
    }

    private string? CurrentUserEmail => User.FindFirstValue(ClaimTypes.Email);

    /// <summary>Persist a user activity event.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ActivityLogResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> LogActivity(
        [FromBody] LogActivityRequest request,
        CancellationToken cancellationToken = default)
    {
        LogActivityCommand command = new(
            request.BranchId,
            CurrentUserId,
            CurrentUserName,
            CurrentUserEmail,
            request.Category,
            request.Action,
            request.Details,
            request.OccurredAt == default ? DateTime.UtcNow : request.OccurredAt);

        ErrorOr<ActivityLogResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            log => Created(string.Empty, log),
            errors => Problem(title: errors[0].Code, detail: errors[0].Description));
    }

    /// <summary>List activity logs for the authenticated tenant (schema-isolated).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ActivityLogResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActivityLogs(
        [FromQuery] Guid? branchId,
        [FromQuery] string? category,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int pageSize = 500,
        CancellationToken cancellationToken = default)
    {
        GetActivityLogsQuery query = new(branchId, category, from, to, pageSize);
        ErrorOr<IReadOnlyList<ActivityLogResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, errors => Problem(title: errors[0].Code, detail: errors[0].Description));
    }
}
