using System.Security.Claims;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.CRM.Application.Commands.AddLoyaltyPoints;
using NexusPOS.CRM.Application.Commands.CreateCustomer;
using NexusPOS.CRM.Application.Commands.RedeemLoyaltyPoints;
using NexusPOS.CRM.Application.Commands.UpdateCustomer;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Application.Queries.CountCustomers;
using NexusPOS.CRM.Application.Queries.GetCustomer;
using NexusPOS.CRM.Application.Queries.GetLoyaltyHistory;
using NexusPOS.CRM.Application.Queries.ListCustomers;

namespace NexusPOS.CRM.Presentation;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/customers")]
[Produces("application/json")]
[Authorize]
public sealed class CustomersController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CustomerResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCustomers(
        Guid tenantId,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListCustomersQuery query = new(tenantId, search, Math.Max(page, 1), Math.Clamp(pageSize, 1, 200));
        ErrorOr<IReadOnlyList<CustomerResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    // The total behind the paged list, kept separate so the list itself stays a plain array for older clients.
    [HttpGet("count")]
    [ProducesResponseType(typeof(CustomerCountResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> CountCustomers(
        Guid tenantId,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        ErrorOr<int> result = await mediator.Send(new CountCustomersQuery(tenantId, search), cancellationToken);
        return result.Match(count => Ok(new CustomerCountResponse(count)), MapErrorsToResult);
    }

    [HttpGet("{customerId:guid}")]
    [ProducesResponseType(typeof(CustomerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCustomer(Guid tenantId, Guid customerId, CancellationToken cancellationToken)
    {
        GetCustomerQuery query = new(customerId, tenantId);
        ErrorOr<CustomerResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CustomerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateCustomer(
        Guid tenantId,
        [FromBody] CreateCustomerRequest request,
        CancellationToken cancellationToken)
    {
        CreateCustomerCommand command = new(
            tenantId, request.Name, request.Email, request.Phone,
            request.Address, request.DateOfBirth, request.Notes, request.MarketingOptIn);
        ErrorOr<CustomerResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            customer => CreatedAtAction(nameof(GetCustomer), new { tenantId, customerId = customer.Id }, customer),
            MapErrorsToResult);
    }

    [HttpPut("{customerId:guid}")]
    [ProducesResponseType(typeof(CustomerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCustomer(
        Guid tenantId,
        Guid customerId,
        [FromBody] UpdateCustomerRequest request,
        CancellationToken cancellationToken)
    {
        UpdateCustomerCommand command = new(
            customerId, tenantId, request.Name, request.Email, request.Phone,
            request.Address, request.DateOfBirth, request.Notes, request.MarketingOptIn);
        ErrorOr<CustomerResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{customerId:guid}/loyalty/add")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(CustomerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddLoyaltyPoints(
        Guid tenantId,
        Guid customerId,
        [FromBody] LoyaltyPointsRequest request,
        CancellationToken cancellationToken)
    {
        AddLoyaltyPointsCommand command = new(customerId, tenantId, request.Points, request.Reason ?? string.Empty, CurrentUserId());
        ErrorOr<CustomerResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("{customerId:guid}/loyalty/redeem")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(CustomerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RedeemLoyaltyPoints(
        Guid tenantId,
        Guid customerId,
        [FromBody] LoyaltyPointsRequest request,
        CancellationToken cancellationToken)
    {
        RedeemLoyaltyPointsCommand command = new(customerId, tenantId, request.Points, request.Reason ?? string.Empty, CurrentUserId());
        ErrorOr<CustomerResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{customerId:guid}/loyalty/history")]
    [ProducesResponseType(typeof(IReadOnlyList<LoyaltyTransactionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLoyaltyHistory(
        Guid tenantId,
        Guid customerId,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        GetLoyaltyHistoryQuery query = new(customerId, tenantId, limit);
        ErrorOr<IReadOnlyList<LoyaltyTransactionResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out Guid id) ? id : null;

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

public sealed record CreateCustomerRequest(
    string Name,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    DateOnly? DateOfBirth = null,
    string? Notes = null,
    bool? MarketingOptIn = null);

public sealed record UpdateCustomerRequest(
    string Name,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    DateOnly? DateOfBirth = null,
    string? Notes = null,
    bool? MarketingOptIn = null);

public sealed record LoyaltyPointsRequest(int Points, string? Reason = null);

public sealed record CustomerCountResponse(int TotalCount);
