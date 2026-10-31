using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Finance.Application.Commands.ApproveExpense;
using NexusPOS.Finance.Application.Commands.CreateExpense;
using NexusPOS.Finance.Application.Commands.VoidExpense;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Application.Queries.GetExpense;
using NexusPOS.Finance.Application.Queries.ListExpenses;
using NexusPOS.Finance.Domain.Enums;

namespace NexusPOS.Finance.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/expenses")]
[Produces("application/json")]
[Authorize]
public sealed class ExpensesController(ISender mediator) : ControllerBase
{
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
        ListExpensesQuery query = new(branchId, category, status, dateFrom, dateTo, page, pageSize);
        ErrorOr<IReadOnlyList<ExpenseResponse>> result = await mediator.Send(query, cancellationToken);
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
        CreateExpenseCommand command = new(
            request.TenantId, branchId, request.Category, request.Amount,
            request.Currency, request.Description, request.ExpenseDate, request.Notes);
        ErrorOr<ExpenseResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            expense => CreatedAtAction(nameof(GetExpense), new { branchId, expenseId = expense.Id }, expense),
            MapErrorsToResult);
    }

    [HttpPost("{expenseId:guid}/approve")]
    [ProducesResponseType(typeof(ExpenseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ApproveExpense(
        Guid branchId,
        Guid expenseId,
        [FromBody] ApproveExpenseRequest request,
        CancellationToken cancellationToken)
    {
        ApproveExpenseCommand command = new(expenseId, branchId, request.ApprovedBy);
        ErrorOr<ExpenseResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{expenseId:guid}/void")]
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

    private IActionResult MapErrorsToResult(List<Error> errors)
    {
        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError,
        };
        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}

public sealed record CreateExpenseRequest(
    Guid TenantId,
    ExpenseCategory Category,
    decimal Amount,
    string Currency,
    string Description,
    DateOnly ExpenseDate,
    string? Notes = null);

public sealed record ApproveExpenseRequest(Guid ApprovedBy);

public sealed record VoidExpenseRequest(string? Reason = null);
