using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Inventory.Application.Commands.AdjustStock;
using NexusPOS.Inventory.Application.Commands.DeleteStockItem;
using NexusPOS.Inventory.Application.Commands.InitializeStock;
using NexusPOS.Inventory.Application.Commands.ReceiveStock;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Application.Queries.GetInventoryAlerts;
using NexusPOS.Inventory.Application.Queries.GetStockItem;
using NexusPOS.Inventory.Application.Queries.ListBranchStock;
using NexusPOS.Inventory.Presentation.Requests;

namespace NexusPOS.Inventory.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/stock")]
[Produces("application/json")]
[Authorize]
public sealed class StockController(ISender mediator) : ControllerBase
{
    /// <summary>List stock items for a branch.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<StockItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListStock(
        Guid branchId,
        [FromQuery] bool lowStockOnly = false,
        CancellationToken cancellationToken = default)
    {
        ListBranchStockQuery query = new(branchId, lowStockOnly);
        ErrorOr<IReadOnlyList<StockItemResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get a single stock item.</summary>
    [HttpGet("{stockItemId:guid}")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStockItem(
        Guid branchId,
        Guid stockItemId,
        CancellationToken cancellationToken)
    {
        GetStockItemQuery query = new(stockItemId, branchId);
        ErrorOr<StockItemResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Initialize a stock item for a variant at this branch.</summary>
    [HttpPost("initialize")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> InitializeStock(
        Guid branchId,
        [FromBody] InitializeStockRequest request,
        CancellationToken cancellationToken)
    {
        InitializeStockCommand command = new(
            request.VariantId, branchId, request.ReorderPoint, request.ReorderQuantity);

        ErrorOr<StockItemResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            stock => CreatedAtAction(nameof(GetStockItem), new { branchId, stockItemId = stock.Id }, stock),
            MapErrorsToResult);
    }

    /// <summary>Record stock receipt for a stock item.</summary>
    [HttpPost("{stockItemId:guid}/receive")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ReceiveStock(
        Guid branchId,
        Guid stockItemId,
        [FromBody] ReceiveStockRequest request,
        CancellationToken cancellationToken)
    {
        ReceiveStockCommand command = new(stockItemId, branchId, request.Quantity, request.Reference, request.Notes, request.ExpiryDate);
        ErrorOr<StockItemResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Adjust stock quantity to a specific value (e.g., after physical count).</summary>
    [HttpPost("{stockItemId:guid}/adjust")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AdjustStock(
        Guid branchId,
        Guid stockItemId,
        [FromBody] AdjustStockRequest request,
        CancellationToken cancellationToken)
    {
        AdjustStockCommand command = new(stockItemId, branchId, request.NewQuantity, request.Reference, request.Notes, request.ExpiryDate, request.ReorderPoint, request.ReorderQuantity, request.NotifyDaysBeforeExpiry);
        ErrorOr<StockItemResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get inventory alerts: expired items, items expiring soon, and low stock items.</summary>
    [HttpGet("/api/v1/branches/{branchId:guid}/inventory/alerts")]
    [ProducesResponseType(typeof(InventoryAlertsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAlerts(
        Guid branchId,
        [FromQuery] int daysAhead = 7,
        CancellationToken cancellationToken = default)
    {
        GetInventoryAlertsQuery query = new(branchId, daysAhead);
        ErrorOr<InventoryAlertsResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Delete a stock item record.</summary>
    [HttpDelete("{stockItemId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteStockItem(
        Guid branchId,
        Guid stockItemId,
        CancellationToken cancellationToken)
    {
        DeleteStockItemCommand command = new(stockItemId, branchId);
        ErrorOr<Success> result = await mediator.Send(command, cancellationToken);

        return result.Match(_ => NoContent(), MapErrorsToResult);
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
