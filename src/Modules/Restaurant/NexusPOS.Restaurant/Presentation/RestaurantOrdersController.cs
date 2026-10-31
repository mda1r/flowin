using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Restaurant.Application.Commands.AddOrderItems;
using NexusPOS.Restaurant.Application.Commands.CancelRestaurantOrder;
using NexusPOS.Restaurant.Application.Commands.CreateKitchenCopy;
using NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;
using NexusPOS.Restaurant.Application.Commands.MarkItemReady;
using NexusPOS.Restaurant.Application.Commands.MarkOrderReady;
using NexusPOS.Restaurant.Application.Commands.PayOrder;
using NexusPOS.Restaurant.Application.Commands.PayTable;
using NexusPOS.Restaurant.Application.Commands.RemoveOrderItem;
using NexusPOS.Restaurant.Application.Commands.ReturnToKitchen;
using NexusPOS.Restaurant.Application.Commands.SendToKitchen;
using NexusPOS.Restaurant.Application.Commands.ServeOrder;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Application.Queries.ListActiveOrders;
using NexusPOS.Restaurant.Application.Queries.ListPaidOrders;
using NexusPOS.Restaurant.Application.Queries.ListTableOrders;
using NexusPOS.SharedKernel.Application;

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

    /// <summary>List orders paid in [from, to).</summary>
    [HttpGet("paid")]
    [ProducesResponseType(typeof(IReadOnlyList<RestaurantOrderResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPaidOrders(
        Guid branchId,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        CancellationToken cancellationToken)
    {
        ListPaidOrdersQuery query = new(branchId, UtcDates.AsUtc(from), UtcDates.AsUtc(to));
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

    /// <summary>Create a new restaurant order, optionally sending it to the kitchen and paying it in the same call.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateOrder(
        Guid branchId,
        [FromBody] CreateRestaurantOrderRequest request,
        CancellationToken cancellationToken)
    {
        CreateRestaurantOrderCommand command = new(
            branchId,
            request.TableNumber,
            [.. request.Items.Select(i => new OrderItemInput(i.MenuItemId, i.Quantity, i.Notes))],
            request.Notes,
            request.DiscountCode,
            request.SendToKitchen,
            request.Payment is null ? null : new OrderPaymentInput(request.Payment.PaymentMethod, request.Payment.AmountTendered),
            request.OrderId);

        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            order => CreatedAtAction(nameof(ListActiveOrders), new { branchId }, order),
            MapErrors);
    }

    /// <summary>Copy a sale completed at the cafe till to the kitchen screen.</summary>
    [HttpPost("kitchen-copy")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateKitchenCopy(
        Guid branchId,
        [FromBody] CreateKitchenCopyRequest request,
        CancellationToken cancellationToken)
    {
        CreateKitchenCopyCommand command = new(
            branchId,
            request.PosOrderId,
            request.TableNumber,
            [.. (request.ItemNotes ?? []).Select(i => new KitchenCopyNoteInput(i.MenuItemId, i.Notes))],
            request.Notes);

        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            order => CreatedAtAction(nameof(ListActiveOrders), new { branchId }, order),
            MapErrors);
    }

    /// <summary>Add another round to an open order.</summary>
    [HttpPost("{orderId:guid}/items")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddOrderItems(
        Guid branchId,
        Guid orderId,
        [FromBody] AddOrderItemsRequest request,
        CancellationToken cancellationToken)
    {
        AddOrderItemsCommand command = new(
            orderId,
            branchId,
            [.. request.Items.Select(i => new OrderItemInput(i.MenuItemId, i.Quantity, i.Notes))],
            request.SendToKitchen);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Void one line the kitchen has not finished (managers only).</summary>
    [HttpDelete("{orderId:guid}/items/{itemId:guid}")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RemoveOrderItem(
        Guid branchId,
        Guid orderId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        RemoveOrderItemCommand command = new(orderId, itemId, branchId);
        ErrorOr<RestaurantOrderResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
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

    /// <summary>Return a ready order back to in-kitchen (undo mark-ready).</summary>
    [HttpPost("{orderId:guid}/return-to-kitchen")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ReturnToKitchen(
        Guid branchId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        ReturnToKitchenCommand command = new(orderId, branchId);
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

    /// <summary>Pay every open order of a table at once.</summary>
    [HttpPost("pay-table")]
    [ProducesResponseType(typeof(IReadOnlyList<RestaurantOrderResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> PayTable(
        Guid branchId,
        [FromBody] PayTableRequest request,
        CancellationToken cancellationToken)
    {
        PayTableCommand command = new(
            branchId, request.TableNumber, request.OrderIds, request.PaymentMethod, request.AmountTendered);
        ErrorOr<IReadOnlyList<RestaurantOrderResponse>> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Cancel an unpaid order with a reason (managers only).</summary>
    [HttpPost("{orderId:guid}/cancel")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(RestaurantOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelOrder(
        Guid branchId,
        Guid orderId,
        [FromBody] CancelOrderRequest request,
        CancellationToken cancellationToken)
    {
        CancelRestaurantOrderCommand command = new(orderId, branchId, request.Reason);
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

// The dish's name and price come from the menu; the tenant comes from the signed-in user.
public sealed record CreateOrderItemRequest(
    Guid MenuItemId,
    int Quantity,
    string? Notes);

public sealed record CreateRestaurantOrderRequest(
    int TableNumber,
    IReadOnlyList<CreateOrderItemRequest> Items,
    string? Notes,
    string? DiscountCode,
    bool SendToKitchen = false,
    PayOrderRequest? Payment = null,
    Guid? OrderId = null);

public sealed record AddOrderItemsRequest(IReadOnlyList<CreateOrderItemRequest> Items, bool SendToKitchen = true);

// The sale's own lines are copied; the till only says which sale, the table, and the cook's notes.
public sealed record KitchenCopyNoteRequest(Guid MenuItemId, string? Notes);

public sealed record CreateKitchenCopyRequest(
    Guid PosOrderId,
    int TableNumber,
    IReadOnlyList<KitchenCopyNoteRequest>? ItemNotes,
    string? Notes);

public sealed record PayOrderRequest(string PaymentMethod, decimal AmountTendered);

public sealed record PayTableRequest(
    int TableNumber,
    IReadOnlyList<Guid> OrderIds,
    string PaymentMethod,
    decimal AmountTendered);

public sealed record CancelOrderRequest(string Reason);
