using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.POS.Application.Commands.CloseShift;
using NexusPOS.POS.Application.Commands.OpenShift;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Application.Queries.GetCurrentShift;
using NexusPOS.POS.Application.Queries.GetShiftSummary;
using NexusPOS.POS.Application.Queries.ListOpenShifts;
using NexusPOS.POS.Application.Queries.ListShifts;
using NexusPOS.POS.Presentation.Requests;
using NexusPOS.SharedKernel.Application;
using NexusPOS.SharedKernel.Presentation;
using System.Security.Claims;

namespace NexusPOS.POS.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/shifts")]
[Produces("application/json")]
[Authorize]
public sealed class ShiftsController(ISender mediator) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    private string CurrentCashierName
    {
        get
        {
            string first = User.FindFirstValue("given_name") ?? string.Empty;
            string last = User.FindFirstValue("family_name") ?? string.Empty;
            string full = $"{first} {last}".Trim();
            return string.IsNullOrEmpty(full)
                ? User.FindFirstValue(ClaimTypes.Email) ?? "كاشير"
                : full;
        }
    }

    /// <summary>Get the current user's open shift for this branch.</summary>
    [HttpGet("current")]
    [ProducesResponseType(typeof(ShiftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GetCurrentShift(Guid branchId, CancellationToken cancellationToken = default)
    {
        GetCurrentShiftQuery query = new(branchId, CurrentUserId);
        ErrorOr<ShiftResponse?> result = await mediator.Send(query, cancellationToken);

        return result.Match(
            shift => shift is null ? NoContent() : Ok(shift),
            MapErrorsToResult);
    }

    private bool IsOwnerOrManager => User.IsInRole("Owner") || User.IsInRole("Manager");

    /// <summary>List all shifts for this branch. Cash variances are manager information.</summary>
    [HttpGet]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(IReadOnlyList<ShiftResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListShifts(
        Guid branchId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListShiftsQuery query = new(branchId, Paging.Page(page), Paging.Size(pageSize));
        ErrorOr<IReadOnlyList<ShiftResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Every shift still open in this branch, whoever opened it, with live totals.</summary>
    [HttpGet("open")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(IReadOnlyList<ShiftResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListOpenShifts(Guid branchId, CancellationToken cancellationToken = default)
    {
        ErrorOr<IReadOnlyList<ShiftResponse>> result = await mediator.Send(new ListOpenShiftsQuery(branchId), cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>One shift with its totals so far, computed on the server. Cashiers may read only their own.</summary>
    [HttpGet("{shiftId:guid}/summary")]
    [ProducesResponseType(typeof(ShiftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetShiftSummary(Guid branchId, Guid shiftId, CancellationToken cancellationToken = default)
    {
        GetShiftSummaryQuery query = new(branchId, shiftId, CurrentUserId, IsOwnerOrManager);
        ErrorOr<ShiftResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Open a new shift for the current user.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ShiftResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> OpenShift(
        Guid branchId,
        [FromBody] OpenShiftRequest request,
        CancellationToken cancellationToken = default)
    {
        OpenShiftCommand command = new(branchId, CurrentUserId, CurrentCashierName, request.OpeningCash);
        ErrorOr<ShiftResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            shift => CreatedAtAction(nameof(GetCurrentShift), new { branchId }, shift),
            MapErrorsToResult);
    }

    /// <summary>Close the current user's open shift.</summary>
    [HttpPost("{shiftId:guid}/close")]
    [ProducesResponseType(typeof(ShiftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CloseShift(
        Guid branchId,
        Guid shiftId,
        [FromBody] CloseShiftRequest request,
        CancellationToken cancellationToken = default)
    {
        CloseShiftCommand command = new(shiftId, branchId, CurrentUserId, request.ClosingCash, request.ClosingCardCount, request.Notes);
        ErrorOr<ShiftResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Close another user's open shift (a cashier who left without closing). The closer's name is kept on the shift.</summary>
    [HttpPost("{shiftId:guid}/force-close")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(ShiftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ForceCloseShift(
        Guid branchId,
        Guid shiftId,
        [FromBody] CloseShiftRequest request,
        CancellationToken cancellationToken = default)
    {
        CloseShiftCommand command = new(
            shiftId, branchId, CurrentUserId, request.ClosingCash, request.ClosingCardCount, request.Notes,
            ClosedByManager: true, ClosedByName: CurrentCashierName);
        ErrorOr<ShiftResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}
