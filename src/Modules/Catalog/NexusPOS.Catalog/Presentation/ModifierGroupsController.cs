using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Catalog.Application.Commands.CreateModifierGroup;
using NexusPOS.Catalog.Application.Commands.DeactivateModifierGroup;
using NexusPOS.Catalog.Application.Commands.SetProductModifierGroups;
using NexusPOS.Catalog.Application.Commands.UpdateModifierGroup;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Queries.ListModifierGroups;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Presentation.Requests;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Catalog.Presentation;

// Add-on groups (milk, extra shot, syrup) and which drinks carry them. The tenant comes from the token only.
[ApiController]
[Route("api/v1/modifier-groups")]
[Produces("application/json")]
[Authorize]
public sealed class ModifierGroupsController(ISender mediator) : ControllerBase
{
    /// <summary>List the tenant's modifier groups with every option and the products each is attached to.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ModifierGroupResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] bool includeInactive, CancellationToken cancellationToken)
    {
        ErrorOr<IReadOnlyList<ModifierGroupResponse>> result =
            await mediator.Send(new ListModifierGroupsQuery(includeInactive), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Create a modifier group with its options.</summary>
    [HttpPost]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(ModifierGroupResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create([FromBody] ModifierGroupRequest request, CancellationToken cancellationToken)
    {
        CreateModifierGroupCommand command = new(
            request.Name ?? string.Empty, request.IsRequired, request.MinSelect, request.MaxSelect, request.SortOrder,
            Drafts(request.Options));

        ErrorOr<ModifierGroupResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(group => StatusCode(StatusCodes.Status201Created, group), MapErrors);
    }

    /// <summary>Update a group; the options list replaces the old one, keeping the ids that are sent back.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(ModifierGroupResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Update(Guid id, [FromBody] ModifierGroupRequest request, CancellationToken cancellationToken)
    {
        UpdateModifierGroupCommand command = new(
            id, request.Name ?? string.Empty, request.IsRequired, request.MinSelect, request.MaxSelect, request.SortOrder,
            Drafts(request.Options));

        ErrorOr<ModifierGroupResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Switch a group off; it leaves every product, and past orders keep resolving it.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        ErrorOr<Success> result = await mediator.Send(new DeactivateModifierGroupCommand(id), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    /// <summary>Set the groups a product carries, in the order the till asks them (an empty list removes all).</summary>
    [HttpPut("/api/v1/products/{productId:guid}/modifier-groups")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetProductGroups(
        Guid productId, [FromBody] SetProductModifierGroupsRequest request, CancellationToken cancellationToken)
    {
        ErrorOr<Success> result = await mediator.Send(
            new SetProductModifierGroupsCommand(productId, request.GroupIds ?? []), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    private static List<ModifierOptionDraft> Drafts(IReadOnlyList<ModifierOptionRequest>? options) =>
        [.. (options ?? []).Select(o => new ModifierOptionDraft(o.Id, o.Name ?? string.Empty, o.PriceDelta, o.IsActive, o.SortOrder))];

    private IActionResult MapErrors(List<Error> errors) => this.ToProblem(errors);
}
