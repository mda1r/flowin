using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.POS.Application.Commands.AddOrderLine;
using NexusPOS.POS.Application.Commands.ApplyOrderDiscount;
using NexusPOS.POS.Application.Commands.CancelOrder;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Commands.CompleteOrder;
using NexusPOS.POS.Application.Commands.CreateOrder;
using NexusPOS.POS.Application.Commands.RedeemOrderLoyaltyPoints;
using NexusPOS.POS.Application.Commands.RemoveOrderLine;
using NexusPOS.POS.Application.Commands.ReturnOrder;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Application.Queries.GetOrder;
using NexusPOS.POS.Application.Queries.ListOrders;
using NexusPOS.POS.Application.Queries.ListReturns;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Presentation.Requests;
using NexusPOS.SharedKernel.Application;
using System.Security.Claims;

namespace NexusPOS.POS.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/orders")]
[Produces("application/json")]
[Authorize]
public sealed class OrdersController(ISender mediator) : ControllerBase
{
    private string? CurrentUserName
    {
        get
        {
            string full = $"{User.FindFirstValue("given_name")} {User.FindFirstValue("family_name")}".Trim();
            return full.Length > 0 ? full : User.FindFirstValue(ClaimTypes.Email);
        }
    }

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
        ListOrdersQuery query = new(
            branchId, status, UtcDates.AsUtc(from), UtcDates.AsUtc(to), Math.Max(page, 1), Math.Clamp(pageSize, 1, 500));
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
        if (!Guid.TryParse(User.FindFirst("tenant_id")?.Value, out Guid tenantId))
        {
            return Forbid();
        }

        // The tenant always comes from the caller's token; the body value is ignored.
        CreateOrderCommand command = new(
            tenantId, branchId, request.Currency, request.CustomerId, request.TaxRate);

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
            request.VariantName, request.UnitPrice, request.CostPrice, request.Quantity);

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
    /// <remarks>Owner or Manager only: cashiers discount through checkout, where the branch cap applies.</remarks>
    [HttpPost("{orderId:guid}/discount")]
    [Authorize(Policy = "OwnerOrManager")]
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

    /// <summary>Redeem the customer loyalty points as a discount on this order (0 clears it).</summary>
    [HttpPost("{orderId:guid}/loyalty")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> RedeemLoyaltyPoints(
        Guid branchId,
        Guid orderId,
        [FromBody] RedeemLoyaltyPointsRequest request,
        CancellationToken cancellationToken)
    {
        ErrorOr<OrderResponse> result = await mediator.Send(
            new RedeemOrderLoyaltyPointsCommand(orderId, branchId, request.Points), cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Create and complete a whole sale in one request; resending the same clientReference returns the same order.</summary>
    [HttpPost("checkout")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Checkout(Guid branchId, [FromBody] CheckoutRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirst("tenant_id")?.Value, out Guid tenantId))
        {
            return Forbid();
        }

        CheckoutOrderCommand command = new(
            tenantId, branchId, request.ClientReference, request.Currency, request.TaxRate, request.CustomerId,
            [.. (request.Lines ?? []).Select(l => new CheckoutOrderCommand.Line(
                l.VariantId, l.ProductName, l.VariantName, l.UnitPrice, l.CostPrice, l.Quantity, l.DiscountType, l.DiscountValue, l.Notes))],
            request.LoyaltyPoints, request.PaymentMethod, request.AmountTendered, request.CashAmount, request.CardAmount,
            UtcDates.AsUtc(request.OfflineCreatedAt), request.DiscountType, request.DiscountValue, request.ApprovalPin,
            ByOwnerOrManager: User.IsInRole("Owner") || User.IsInRole("Manager"),
            UserId: Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out Guid userId) ? userId : Guid.Empty,
            UserName: CurrentUserName,
            Kitchen: request.Kitchen is { } k ? new CheckoutOrderCommand.KitchenTicket(k.TableNumber, k.Takeaway) : null);
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
        CompleteOrderCommand command = new(orderId, branchId, request.PaymentMethod, request.AmountTendered, request.CashAmount, request.CardAmount);
        ErrorOr<OrderResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Process a return for a completed order; refunds are for owners and managers only.</summary>
    [HttpPost("{orderId:guid}/return")]
    [Authorize(Policy = "OwnerOrManager")]
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
            [.. (request.Lines ?? []).Select(l => new ReturnOrderLineInput(l.LineId, l.Quantity, l.Reason))],
            request.RestockItems,
            Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out Guid userId) ? userId : null,
            CurrentUserName,
            request.Note,
            request.ClientReference);

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
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}
