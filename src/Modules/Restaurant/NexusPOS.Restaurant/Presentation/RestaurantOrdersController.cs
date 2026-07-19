using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Restaurant.Application.Commands.CancelRestaurantOrder;
using NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;
using NexusPOS.Restaurant.Application.Commands.MarkItemReady;
using NexusPOS.Restaurant.Application.Commands.MarkOrderReady;
using NexusPOS.Restaurant.Application.Commands.PayOrder;
using NexusPOS.Restaurant.Application.Commands.SendToKitchen;
using NexusPOS.Restaurant.Application.Commands.ServeOrder;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Application.Queries.ListActiveOrders;
using NexusPOS.Restaurant.Application.Queries.ListTableOrders;

namespace NexusPOS.Restaurant.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/restaurant/orders")]
[Produces("application/json")]
[Authorize]
public sealed class RestaurantOrdersController(ISender mediator) : ControllerBase
{
    /// <summary>List all active (non-paid, non-cancelled) orders for a branch.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RestaurantOrderResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListActiveOrders(
        Guid branchId,
        CancellationToken cancellationToken)
    {
        ListActiveOrdersQuery query = new(branchId);
        ErrorOr<IReadOnlyList<RestaurantOrderResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>List today's orders for a specific table.</summary>
    [HttpGet("by-table/{tableNumber:int}")]
    [ProducesResponseType(typeof(IReadOnlyList<RestaurantOrderResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTableOrders(
        Guid branchId,
        int tableNumber,
        CancellationToken cancellationToken)
    {
        ListTableOrdersQuery query = new(branchId, tableNumber);
        ErrorOr<IReadOnlyList<RestaurantOrderResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Create a new restaurant order.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateOrder(
        Guid branchId,
        [FromBody] CreateRestaurantOrderRequest request,
        CancellationToken cancellationToken)
    {
        var items = request.Items
            .Select(i => new OrderItemInput(i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice, i.Notes))
            .ToList();

        CreateRestaurantOrderCommand command = new(
            request.TenantId, branchId, request.TableNumber, items, request.Notes, request.DiscountCode);

        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            order => CreatedAtAction(nameof(ListActiveOrders), new { branchId }, order),
            MapErrors);
    }

    /// <summary>Send order to kitchen.</summary>
    [HttpPost("{orderId:guid}/send-to-kitchen")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SendToKitchen(
        Guid branchId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        SendToKitchenCommand command = new(orderId, branchId);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Mark a specific order item as ready.</summary>
    [HttpPost("{orderId:guid}/items/{itemId:guid}/mark-ready")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkItemReady(
        Guid branchId,
        Guid orderId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        MarkItemReadyCommand command = new(orderId, itemId, branchId);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Mark the whole order as ready (kitchen display button).</summary>
    [HttpPost("{orderId:guid}/mark-ready")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> MarkOrderReady(
        Guid branchId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        MarkOrderReadyCommand command = new(orderId, branchId);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Mark order as served to the table.</summary>
    [HttpPost("{orderId:guid}/serve")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ServeOrder(
        Guid branchId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        ServeOrderCommand command = new(orderId, branchId);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Process payment for an order.</summary>
    [HttpPost("{orderId:guid}/pay")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> PayOrder(
        Guid branchId,
        Guid orderId,
        [FromBody] PayOrderRequest request,
        CancellationToken cancellationToken)
    {
        PayOrderCommand command = new(orderId, branchId, request.PaymentMethod, request.AmountTendered);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Cancel an order.</summary>
    [HttpPost("{orderId:guid}/cancel")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelOrder(
        Guid branchId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        CancelRestaurantOrderCommand command = new(orderId, branchId);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    private IActionResult MapErrors(List<Error> errors)
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

public sealed record CreateOrderItemRequest(
    Guid MenuItemId,
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    string? Notes);

public sealed record CreateRestaurantOrderRequest(
    Guid TenantId,
    int TableNumber,
    IReadOnlyList<CreateOrderItemRequest> Items,
    string? Notes,
    string? DiscountCode);

public sealed record PayOrderRequest(string PaymentMethod, decimal AmountTendered);
