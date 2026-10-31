using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Inventory.Application.Commands.CompleteStockCountSession;
using NexusPOS.Inventory.Application.Commands.CreateStockCountSession;
using NexusPOS.Inventory.Application.Commands.SaveStockCountItems;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Application.Queries.GetStockCountSession;
using NexusPOS.Inventory.Application.Queries.ListStockCountSessions;
using NexusPOS.Inventory.Presentation.Requests;

namespace NexusPOS.Inventory.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/stock-counts")]
[Produces("application/json")]
[Authorize]
public sealed class StockCountController(ISender mediator) : ControllerBase
{
    /// <summary>List stock count sessions for a branch.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<StockCountSessionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListSessions(
        Guid branchId,
        CancellationToken cancellationToken = default)
    {
        ListStockCountSessionsQuery query = new(branchId);
        ErrorOr<IReadOnlyList<StockCountSessionResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get a single stock count session with all items.</summary>
    [HttpGet("{sessionId:guid}")]
    [ProducesResponseType(typeof(StockCountSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSession(
        Guid branchId,
        Guid sessionId,
        CancellationToken cancellationToken = default)
    {
        GetStockCountSessionQuery query = new(branchId, sessionId);
        ErrorOr<StockCountSessionResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Create a new stock count session.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(StockCountSessionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateSession(
        Guid branchId,
        [FromBody] CreateStockCountSessionRequest request,
        CancellationToken cancellationToken = default)
    {
        CreateStockCountSessionCommand command = new(
            branchId,
            request.Type,
            request.PeriodStart,
            request.PeriodEnd,
            request.Notes,
            request.Items
                .Select(i => new CreateStockCountSessionItemInput(i.StockItemId, i.VariantId, i.SystemQuantity, i.UnitCost))
                .ToList());

        ErrorOr<StockCountSessionResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            session => CreatedAtAction(nameof(GetSession), new { branchId, sessionId = session.Id }, session),
            MapErrorsToResult);
    }

    /// <summary>Save counted quantities for items in a session.</summary>
    [HttpPut("{sessionId:guid}/items")]
    [ProducesResponseType(typeof(StockCountSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> SaveItems(
        Guid branchId,
        Guid sessionId,
        [FromBody] SaveStockCountItemsRequest request,
        CancellationToken cancellationToken = default)
    {
        SaveStockCountItemsCommand command = new(
            branchId,
            sessionId,
            request.Items
                .Select(i => new SaveStockCountItemInput(i.StockItemId, i.CountedQuantity))
                .ToList());

        ErrorOr<StockCountSessionResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Complete a stock count session, optionally auto-adjusting stock quantities.</summary>
    [HttpPost("{sessionId:guid}/complete")]
    [ProducesResponseType(typeof(StockCountSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CompleteSession(
        Guid branchId,
        Guid sessionId,
        [FromBody] CompleteStockCountSessionRequest request,
        CancellationToken cancellationToken = default)
    {
        CompleteStockCountSessionCommand command = new(branchId, sessionId, request.AutoAdjust);
        ErrorOr<StockCountSessionResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors)
    {
        if (errors.TrueForAll(e => e.Type == ErrorType.Validation))
        {
            ValidationProblemDetails problemDetails = new();
            foreach (Error error in errors)
            {
                problemDetails.Errors[error.Code] = [error.Description];
            }

            return ValidationProblem(problemDetails);
        }

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
