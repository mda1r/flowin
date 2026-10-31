using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.POS.Application.Commands.LogActivity;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Application.Queries.GetActivityLogs;
using NexusPOS.POS.Presentation.Requests;
using NexusPOS.SharedKernel.Application;
using NexusPOS.SharedKernel.Presentation;
using System.Security.Claims;

namespace NexusPOS.POS.Presentation;

[ApiController]
[Route("api/v1/activity-logs")]
[Produces("application/json")]
[Authorize(Policy = "TenantUser")]
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
            this.ToProblem);
    }

    /// <summary>
    /// List activity logs for the authenticated tenant (schema-isolated). Owner/Manager only:
    /// the trail covers shifts, stock changes and staff edits.
    /// </summary>
    /// <remarks>
    /// <c>branchId</c> also returns tenant-wide entries (no branch). <c>from</c>/<c>to</c> accept an
    /// offset (e.g. 2026-10-31T00:00:00+03:00) so "today" means the shop's local day.
    /// </remarks>
    [HttpGet]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(IReadOnlyList<ActivityLogResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActivityLogs(
        [FromQuery] Guid? branchId,
        [FromQuery] string? category,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int pageSize = 500,
        [FromQuery] int skip = 0,
        CancellationToken cancellationToken = default)
    {
        GetActivityLogsQuery query = new(branchId, category, from?.UtcDateTime, to?.UtcDateTime, Paging.Size(pageSize, 500), skip);
        ErrorOr<IReadOnlyList<ActivityLogResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, this.ToProblem);
    }
}
