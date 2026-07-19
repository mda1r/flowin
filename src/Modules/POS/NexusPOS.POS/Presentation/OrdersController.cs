using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.POS.Application.Commands.AddOrderLine;
using NexusPOS.POS.Application.Commands.ApplyOrderDiscount;
using NexusPOS.POS.Application.Commands.CancelOrder;
using NexusPOS.POS.Application.Commands.CompleteOrder;
using NexusPOS.POS.Application.Commands.CreateOrder;
using NexusPOS.POS.Application.Commands.RemoveOrderLine;
using NexusPOS.POS.Application.Commands.ReturnOrder;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Application.Queries.GetOrder;
using NexusPOS.POS.Application.Queries.ListOrders;
using NexusPOS.POS.Application.Queries.ListReturns;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Presentation.Requests;

namespace NexusPOS.POS.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/orders")]
[Produces("application/json")]
[Authorize]
public sealed class OrdersController(ISender mediator) : ControllerBase
{
    /// <summary>List orders for a branch.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<OrderResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListOrders(
        Guid branchId,
        [FromQuery] OrderStatus? status = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        ListOrdersQuery query = new(branchId, status, from, to, page, pageSize);
        ErrorOr<IReadOnlyList<OrderResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get an order by id.</summary>
    [HttpGet("{orderId:guid}")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrder(
        Guid branchId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        GetOrderQuery query = new(orderId, branchId);
        ErrorOr<OrderResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Create a new order.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateOrder(
        Guid branchId,
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        CreateOrderCommand command = new(
            request.TenantId, branchId, request.Currency, request.CustomerId, request.TaxRate);

        ErrorOr<OrderResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            order => CreatedAtAction(nameof(GetOrder), new { branchId, orderId = order.Id }, order),
            MapErrorsToResult);
    }

    /// <summary>Add a line item to an open order.</summary>
    [HttpPost("{orderId:guid}/lines")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AddLine(
        Guid branchId,
        Guid orderId,
        [FromBody] AddOrderLineRequest request,
        CancellationToken cancellationToken)
    {
        AddOrderLineCommand command = new(
            orderId, branchId, request.VariantId, request.ProductName,
            request.VariantName, request.UnitPrice, request.Quantity);

        ErrorOr<OrderResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Remove a line item from an open order.</summary>
    [HttpDelete("{orderId:guid}/lines/{lineId:guid}")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveLine(
        Guid branchId,
        Guid orderId,
        Guid lineId,
        CancellationToken cancellationToken)
    {
        RemoveOrderLineCommand command = new(orderId, branchId, lineId);
        ErrorOr<OrderResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Apply a discount to the order total.</summary>
    [HttpPost("{orderId:guid}/discount")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ApplyDiscount(
        Guid branchId,
        Guid orderId,
        [FromBody] ApplyDiscountRequest request,
        CancellationToken cancellationToken)
    {
        ApplyOrderDiscountCommand command = new(orderId, branchId, request.DiscountType, request.DiscountValue);
        ErrorOr<OrderResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Complete an order and record payment.</summary>
    [HttpPost("{orderId:guid}/complete")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CompleteOrder(
        Guid branchId,
        Guid orderId,
        [FromBody] CompleteOrderRequest request,
        CancellationToken cancellationToken)
    {
        CompleteOrderCommand command = new(orderId, branchId, request.PaymentMethod, request.AmountTendered);
        ErrorOr<OrderResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Process a return for a completed order.</summary>
    [HttpPost("{orderId:guid}/return")]
    [ProducesResponseType(typeof(ReturnOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ReturnOrder(
        Guid branchId,
        Guid orderId,
        [FromBody] ReturnOrderRequest request,
        CancellationToken cancellationToken)
    {
        ReturnOrderCommand command = new(
            orderId,
            branchId,
            request.RefundMethod,
            request.Lines.Select(l => new ReturnOrderLineInput(l.LineId, l.Quantity, l.Reason)).ToList());

        ErrorOr<ReturnOrderResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            ret => CreatedAtAction(nameof(ListReturns), new { branchId }, ret),
            MapErrorsToResult);
    }

    /// <summary>List returns for a branch.</summary>
    [HttpGet("/api/v1/branches/{branchId:guid}/returns")]
    [ProducesResponseType(typeof(IReadOnlyList<ReturnOrderResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListReturns(
        Guid branchId,
        CancellationToken cancellationToken)
    {
        ListReturnsQuery query = new(branchId);
        ErrorOr<IReadOnlyList<ReturnOrderResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Cancel an open order.</summary>
    [HttpPost("{orderId:guid}/cancel")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelOrder(
        Guid branchId,
        Guid orderId,
        [FromBody] CancelOrderRequest request,
        CancellationToken cancellationToken)
    {
        CancelOrderCommand command = new(orderId, branchId, request.Reason);
        ErrorOr<OrderResponse> result = await mediator.Send(command, cancellationToken);

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
