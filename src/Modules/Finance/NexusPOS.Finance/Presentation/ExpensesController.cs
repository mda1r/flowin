using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Finance.Application.Commands.ApproveExpense;
using NexusPOS.Finance.Application.Commands.CreateExpense;
using NexusPOS.Finance.Application.Commands.UpdateExpense;
using NexusPOS.Finance.Application.Commands.VoidExpense;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Application.Queries.GetExpense;
using NexusPOS.Finance.Application.Queries.GetExpenseSummary;
using NexusPOS.Finance.Application.Queries.ListExpenses;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.SharedKernel.Application;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Finance.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/expenses")]
[Produces("application/json")]
[Authorize]
public sealed class ExpensesController(ISender mediator, IAuthorizationService authorization) : ControllerBase
{
    // Who may approve, void and edit expenses. Approve-on-create uses the same rule, so it grants nothing new.
    internal const string ApproverPolicy = "OwnerManagerOrAccountant";

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ExpenseResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListExpenses(
        Guid branchId,
        [FromQuery] ExpenseCategory? category = null,
        [FromQuery] ExpenseStatus? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListExpensesQuery query = new(branchId, category, status, dateFrom, dateTo, Paging.Page(page), Paging.Size(pageSize));
        ErrorOr<IReadOnlyList<ExpenseResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Totals by status and by category (approved only) for a date range.</summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(ExpenseSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> GetSummary(
        Guid branchId,
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        CancellationToken cancellationToken = default)
    {
        GetExpenseSummaryQuery query = new(branchId, dateFrom, dateTo);
        ErrorOr<ExpenseSummaryResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{expenseId:guid}")]
    [ProducesResponseType(typeof(ExpenseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetExpense(Guid branchId, Guid expenseId, CancellationToken cancellationToken)
    {
        GetExpenseQuery query = new(expenseId, branchId);
        ErrorOr<ExpenseResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ExpenseResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateExpense(
        Guid branchId,
        [FromBody] CreateExpenseRequest request,
        CancellationToken cancellationToken)
    {
        // A cashier's "approve now" is ignored: the expense still waits for a manager.
        bool approveNow = request.ApproveNow
            && (await authorization.AuthorizeAsync(User, ApproverPolicy)).Succeeded;

        CreateExpenseCommand command = new(
            branchId, request.Category, request.Amount,
            request.Description, request.ExpenseDate, request.Notes, approveNow);
        ErrorOr<ExpenseResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            expense => CreatedAtAction(nameof(GetExpense), new { branchId, expenseId = expense.Id }, expense),
            MapErrorsToResult);
    }

    /// <summary>Corrects an expense that is still pending; approved or voided ones are refused with 409.</summary>
    [HttpPut("{expenseId:guid}")]
    [Authorize(Policy = ApproverPolicy)]
    [ProducesResponseType(typeof(ExpenseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateExpense(
        Guid branchId,
        Guid expenseId,
        [FromBody] UpdateExpenseRequest request,
        CancellationToken cancellationToken)
    {
        UpdateExpenseCommand command = new(
            expenseId, branchId, request.Category, request.Amount,
            request.Description, request.ExpenseDate, request.Notes);
        ErrorOr<ExpenseResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{expenseId:guid}/approve")]
    [Authorize(Policy = ApproverPolicy)]
    [ProducesResponseType(typeof(ExpenseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ApproveExpense(
        Guid branchId,
        Guid expenseId,
        CancellationToken cancellationToken)
    {
        ApproveExpenseCommand command = new(expenseId, branchId);
        ErrorOr<ExpenseResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{expenseId:guid}/void")]
    [Authorize(Policy = ApproverPolicy)]
    [ProducesResponseType(typeof(ExpenseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> VoidExpense(
        Guid branchId,
        Guid expenseId,
        [FromBody] VoidExpenseRequest? request,
        CancellationToken cancellationToken)
    {
        VoidExpenseCommand command = new(expenseId, branchId, request?.Reason);
        ErrorOr<ExpenseResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}

// No currency field: expenses are always in the shop's currency.
public sealed record CreateExpenseRequest(
    ExpenseCategory Category,
    decimal Amount,
    string Description,
    DateOnly ExpenseDate,
    string? Notes = null,
    bool ApproveNow = false);

public sealed record UpdateExpenseRequest(
    ExpenseCategory Category,
    decimal Amount,
    string Description,
    DateOnly ExpenseDate,
    string? Notes = null);

public sealed record VoidExpenseRequest(string? Reason = null);
