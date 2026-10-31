using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Inventory.Application.Commands.AdjustStock;
using NexusPOS.Inventory.Application.Commands.DeleteStockItem;
using NexusPOS.Inventory.Application.Commands.InitializeStock;
using NexusPOS.Inventory.Application.Commands.ReceiveStock;
using NexusPOS.Inventory.Application.Commands.SetStockItemArchived;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Application.Queries.GetInventoryAlerts;
using NexusPOS.Inventory.Application.Queries.GetStockItem;
using NexusPOS.Inventory.Application.Queries.ListBranchStock;
using NexusPOS.Inventory.Application.Queries.ListStockMovements;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Services;
using NexusPOS.Inventory.Presentation.Requests;
using NexusPOS.SharedKernel.Presentation;

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
        [FromQuery] bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        ListBranchStockQuery query = new(branchId, lowStockOnly, includeArchived);
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

    /// <summary>The item's stock card: its movements, newest first, optionally filtered by type and Riyadh calendar days.</summary>
    [HttpGet("{stockItemId:guid}/movements")]
    [ProducesResponseType(typeof(StockMovementsPageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListMovements(
        Guid branchId,
        Guid stockItemId,
        [FromQuery] MovementType? type = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        ListStockMovementsQuery query = new(
            stockItemId, branchId, type,
            from.HasValue ? StoreCalendar.StartOfDayUtc(from.Value) : null,
            to.HasValue ? StoreCalendar.StartOfDayUtc(to.Value.AddDays(1)) : null,
            page, pageSize);
        ErrorOr<StockMovementsPageResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
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
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AdjustStock(
        Guid branchId,
        Guid stockItemId,
        [FromBody] AdjustStockRequest request,
        CancellationToken cancellationToken)
    {
        AdjustStockCommand command = new(stockItemId, branchId, request.NewQuantity, request.Reference, request.Notes, request.ExpiryDate, request.ReorderPoint, request.ReorderQuantity, request.NotifyDaysBeforeExpiry, request.ClearExpiry);
        ErrorOr<StockItemResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get inventory alerts: expired items, items expiring soon, and low stock items.</summary>
    [HttpGet("/api/v1/branches/{branchId:guid}/inventory/alerts")]
    [ProducesResponseType(typeof(InventoryAlertsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAlerts(
        Guid branchId,
        [FromQuery] int? daysAhead = null,
        CancellationToken cancellationToken = default)
    {
        // Without daysAhead each item uses its own NotifyDaysBeforeExpiry window.
        GetInventoryAlertsQuery query = new(branchId, daysAhead is null ? null : Math.Clamp(daysAhead.Value, 0, 365));
        ErrorOr<InventoryAlertsResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Delete a stock item that has no quantity and no history; anything else must be archived.</summary>
    [HttpDelete("{stockItemId:guid}")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteStockItem(
        Guid branchId,
        Guid stockItemId,
        CancellationToken cancellationToken)
    {
        DeleteStockItemCommand command = new(stockItemId, branchId);
        ErrorOr<Success> result = await mediator.Send(command, cancellationToken);

        return result.Match(_ => NoContent(), MapErrorsToResult);
    }

    /// <summary>Stop tracking a stock item while keeping its movement history.</summary>
    [HttpPost("{stockItemId:guid}/archive")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public Task<IActionResult> ArchiveStockItem(Guid branchId, Guid stockItemId, CancellationToken cancellationToken) =>
        SetArchived(branchId, stockItemId, archived: true, cancellationToken);

    /// <summary>Track an archived stock item again.</summary>
    [HttpPost("{stockItemId:guid}/restore")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public Task<IActionResult> RestoreStockItem(Guid branchId, Guid stockItemId, CancellationToken cancellationToken) =>
        SetArchived(branchId, stockItemId, archived: false, cancellationToken);

    private async Task<IActionResult> SetArchived(
        Guid branchId, Guid stockItemId, bool archived, CancellationToken cancellationToken)
    {
        ErrorOr<StockItemResponse> result = await mediator.Send(
            new SetStockItemArchivedCommand(stockItemId, branchId, archived), cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}
