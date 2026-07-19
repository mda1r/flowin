using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Purchasing.Application.Commands.AddPurchaseOrderLine;
using NexusPOS.Purchasing.Application.Commands.CancelPurchaseOrder;
using NexusPOS.Purchasing.Application.Commands.CreatePurchaseOrder;
using NexusPOS.Purchasing.Application.Commands.ReceivePurchaseOrder;
using NexusPOS.Purchasing.Application.Commands.RemovePurchaseOrderLine;
using NexusPOS.Purchasing.Application.Commands.SendPurchaseOrder;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Application.Queries.GetPurchaseOrder;
using NexusPOS.Purchasing.Application.Queries.ListPurchaseOrders;
using NexusPOS.Purchasing.Domain.Enums;

namespace NexusPOS.Purchasing.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/purchase-orders")]
[Produces("application/json")]
[Authorize]
public sealed class PurchaseOrdersController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PurchaseOrderResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPurchaseOrders(
        Guid branchId,
        [FromQuery] PurchaseOrderStatus? status = null,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListPurchaseOrdersQuery query = new(branchId, status, supplierId, page, pageSize);
        ErrorOr<IReadOnlyList<PurchaseOrderResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{purchaseOrderId:guid}")]
    [ProducesResponseType(typeof(PurchaseOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPurchaseOrder(Guid branchId, Guid purchaseOrderId, CancellationToken cancellationToken)
    {
        GetPurchaseOrderQuery query = new(purchaseOrderId, branchId);
        ErrorOr<PurchaseOrderResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(PurchaseOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreatePurchaseOrder(
        Guid branchId,
        [FromBody] CreatePurchaseOrderRequest request,
        CancellationToken cancellationToken)
    {
        CreatePurchaseOrderCommand command = new(
            request.TenantId, branchId, request.SupplierId, request.ExpectedDeliveryDate, request.Notes);
        ErrorOr<PurchaseOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            order => CreatedAtAction(nameof(GetPurchaseOrder), new { branchId, purchaseOrderId = order.Id }, order),
            MapErrorsToResult);
    }

    [HttpPost("{purchaseOrderId:guid}/lines")]
    [ProducesResponseType(typeof(PurchaseOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddLine(
        Guid branchId,
        Guid purchaseOrderId,
        [FromBody] AddPurchaseOrderLineRequest request,
        CancellationToken cancellationToken)
    {
        AddPurchaseOrderLineCommand command = new(
            purchaseOrderId, branchId, request.VariantId, request.Description, request.UnitCost, request.Quantity);
        ErrorOr<PurchaseOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpDelete("{purchaseOrderId:guid}/lines/{lineId:guid}")]
    [ProducesResponseType(typeof(PurchaseOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveLine(Guid branchId, Guid purchaseOrderId, Guid lineId, CancellationToken cancellationToken)
    {
        RemovePurchaseOrderLineCommand command = new(purchaseOrderId, branchId, lineId);
        ErrorOr<PurchaseOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{purchaseOrderId:guid}/send")]
    [ProducesResponseType(typeof(PurchaseOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SendPurchaseOrder(Guid branchId, Guid purchaseOrderId, CancellationToken cancellationToken)
    {
        SendPurchaseOrderCommand command = new(purchaseOrderId, branchId);
        ErrorOr<PurchaseOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{purchaseOrderId:guid}/receive")]
    [ProducesResponseType(typeof(PurchaseOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReceivePurchaseOrder(Guid branchId, Guid purchaseOrderId, CancellationToken cancellationToken)
    {
        ReceivePurchaseOrderCommand command = new(purchaseOrderId, branchId);
        ErrorOr<PurchaseOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{purchaseOrderId:guid}/cancel")]
    [ProducesResponseType(typeof(PurchaseOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelPurchaseOrder(
        Guid branchId,
        Guid purchaseOrderId,
        [FromBody] CancelPurchaseOrderRequest? request,
        CancellationToken cancellationToken)
    {
        CancelPurchaseOrderCommand command = new(purchaseOrderId, branchId, request?.Reason);
        ErrorOr<PurchaseOrderResponse> result = await mediator.Send(command, cancellationToken);
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

public sealed record CreatePurchaseOrderRequest(
    Guid TenantId,
    Guid SupplierId,
    DateTime? ExpectedDeliveryDate = null,
    string? Notes = null);

public sealed record AddPurchaseOrderLineRequest(
    Guid VariantId,
    string Description,
    decimal UnitCost,
    decimal Quantity);

public sealed record CancelPurchaseOrderRequest(string? Reason = null);
