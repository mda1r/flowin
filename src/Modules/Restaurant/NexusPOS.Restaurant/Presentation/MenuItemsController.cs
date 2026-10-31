using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Restaurant.Application.Commands.CreateMenuItem;
using NexusPOS.Restaurant.Application.Commands.SetMenuItemAvailability;
using NexusPOS.Restaurant.Application.Commands.UpdateMenuItem;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Application.Queries.GetMenuItem;
using NexusPOS.Restaurant.Application.Queries.ListMenuItems;
using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/menu-items")]
[Produces("application/json")]
[Authorize]
public sealed class MenuItemsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MenuItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListMenuItems(
        Guid branchId,
        [FromQuery] MenuCategory? category = null,
        [FromQuery] bool includeUnavailable = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListMenuItemsQuery query = new(branchId, category, includeUnavailable, page, pageSize);
        ErrorOr<IReadOnlyList<MenuItemResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{menuItemId:guid}")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMenuItem(Guid branchId, Guid menuItemId, CancellationToken cancellationToken)
    {
        GetMenuItemQuery query = new(menuItemId, branchId);
        ErrorOr<MenuItemResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateMenuItem(
        Guid branchId,
        [FromBody] CreateMenuItemRequest request,
        CancellationToken cancellationToken)
    {
        CreateMenuItemCommand command = new(
            request.TenantId, branchId, request.Category, request.Name,
            request.Description, request.Price, request.Currency, request.SortOrder);
        ErrorOr<MenuItemResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            item => CreatedAtAction(nameof(GetMenuItem), new { branchId, menuItemId = item.Id }, item),
            MapErrorsToResult);
    }

    [HttpPut("{menuItemId:guid}")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateMenuItem(
        Guid branchId,
        Guid menuItemId,
        [FromBody] UpdateMenuItemRequest request,
        CancellationToken cancellationToken)
    {
        UpdateMenuItemCommand command = new(
            menuItemId, branchId, request.Category, request.Name,
            request.Description, request.Price, request.SortOrder);
        ErrorOr<MenuItemResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPatch("{menuItemId:guid}/availability")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetMenuItemAvailability(
        Guid branchId,
        Guid menuItemId,
        [FromBody] SetMenuItemAvailabilityRequest request,
        CancellationToken cancellationToken)
    {
        SetMenuItemAvailabilityCommand command = new(menuItemId, branchId, request.IsAvailable);
        ErrorOr<MenuItemResponse> result = await mediator.Send(command, cancellationToken);
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

public sealed record CreateMenuItemRequest(
    Guid TenantId,
    MenuCategory Category,
    string Name,
    string Description,
    decimal Price,
    string Currency,
    int SortOrder);

public sealed record UpdateMenuItemRequest(
    MenuCategory Category,
    string Name,
    string Description,
    decimal Price,
    int SortOrder);

public sealed record SetMenuItemAvailabilityRequest(bool IsAvailable);
