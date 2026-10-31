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
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Restaurant.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/menu-items")]
[Produces("application/json")]
[Authorize]
public sealed class MenuItemsController(ISender mediator, ITenantContext tenantContext) : ControllerBase
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
        ListMenuItemsQuery query = new(branchId, category, includeUnavailable, Paging.Page(page), Paging.Size(pageSize));
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
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateMenuItem(
        Guid branchId,
        [FromBody] CreateMenuItemRequest request,
        CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Unauthorized();
        }

        CreateMenuItemCommand command = new(
            tenantId, branchId, request.Category, request.Name,
            request.Description, request.Price, request.Currency, request.SortOrder);
        ErrorOr<MenuItemResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            item => CreatedAtAction(nameof(GetMenuItem), new { branchId, menuItemId = item.Id }, item),
            MapErrorsToResult);
    }

    [HttpPut("{menuItemId:guid}")]
    [Authorize(Policy = "OwnerOrManager")]
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
    [Authorize(Policy = "OwnerOrManager")]
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

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}

public sealed record CreateMenuItemRequest(
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
