using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Inventory.Application.Commands.SetRecipe;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Application.Queries.GetRecipe;
using NexusPOS.Inventory.Application.Queries.ListRecipeSummaries;

namespace NexusPOS.Inventory.Presentation;

public sealed record SetRecipeRequest(IReadOnlyList<SetRecipeRequest.Line> Lines)
{
    public sealed record Line(Guid MaterialId, decimal Quantity);
}

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/recipes")]
[Produces("application/json")]
[Authorize]
public sealed class RecipesController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RecipeSummaryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid tenantId, CancellationToken cancellationToken)
    {
        ErrorOr<IReadOnlyList<RecipeSummaryResponse>> result =
            await mediator.Send(new ListRecipeSummariesQuery(tenantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    [HttpGet("{variantId:guid}")]
    [ProducesResponseType(typeof(RecipeResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid tenantId, Guid variantId, CancellationToken cancellationToken)
    {
        ErrorOr<RecipeResponse> result = await mediator.Send(new GetRecipeQuery(tenantId, variantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    [HttpPut("{variantId:guid}")]
    [ProducesResponseType(typeof(RecipeResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Set(
        Guid tenantId, Guid variantId, [FromBody] SetRecipeRequest request, CancellationToken cancellationToken)
    {
        ErrorOr<RecipeResponse> result = await mediator.Send(
            new SetRecipeCommand(tenantId, variantId,
                (request.Lines ?? []).Select(l => new SetRecipeCommand.Line(l.MaterialId, l.Quantity)).ToList()),
            cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    private IActionResult MapErrors(List<Error> errors)
    {
        Error first = errors[0];
        int status = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError,
        };
        return Problem(title: first.Code, detail: first.Description, statusCode: status);
    }
}
