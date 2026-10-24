using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterial;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterialCategory;
using NexusPOS.Inventory.Application.Commands.DeleteStockMaterial;
using NexusPOS.Inventory.Application.Commands.DeleteStockMaterialCategory;
using NexusPOS.Inventory.Application.Commands.UpdateStockMaterial;
using NexusPOS.Inventory.Application.Commands.UpdateStockMaterialCategory;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Application.Queries.GetStockMaterial;
using NexusPOS.Inventory.Application.Queries.ListStockMaterialCategories;
using NexusPOS.Inventory.Application.Queries.ListStockMaterials;
using NexusPOS.Inventory.Presentation.Requests;

namespace NexusPOS.Inventory.Presentation;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/stock-materials")]
[Produces("application/json")]
[Authorize]
public sealed class StockMaterialController(ISender mediator) : ControllerBase
{
    // ─── Categories ───────────────────────────────────────────────────────────

    [HttpGet("categories")]
    [ProducesResponseType(typeof(IReadOnlyList<StockMaterialCategoryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCategories(Guid tenantId, CancellationToken cancellationToken)
    {
        ErrorOr<IReadOnlyList<StockMaterialCategoryResponse>> result =
            await mediator.Send(new ListStockMaterialCategoriesQuery(tenantId), cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost("categories")]
    [ProducesResponseType(typeof(StockMaterialCategoryResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory(
        Guid tenantId,
        [FromBody] CreateStockMaterialCategoryRequest request,
        CancellationToken cancellationToken)
    {
        ErrorOr<StockMaterialCategoryResponse> result =
            await mediator.Send(new CreateStockMaterialCategoryCommand(tenantId, request.Name), cancellationToken);
        return result.Match(r => CreatedAtAction(nameof(ListCategories), new { tenantId }, r), MapErrorsToResult);
    }

    [HttpPut("categories/{categoryId:guid}")]
    [ProducesResponseType(typeof(StockMaterialCategoryResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCategory(
        Guid tenantId, Guid categoryId,
        [FromBody] UpdateStockMaterialCategoryRequest request,
        CancellationToken cancellationToken)
    {
        ErrorOr<StockMaterialCategoryResponse> result =
            await mediator.Send(new UpdateStockMaterialCategoryCommand(tenantId, categoryId, request.Name), cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpDelete("categories/{categoryId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteCategory(
        Guid tenantId, Guid categoryId, CancellationToken cancellationToken)
    {
        ErrorOr<Success> result =
            await mediator.Send(new DeleteStockMaterialCategoryCommand(tenantId, categoryId), cancellationToken);
        return result.Match(_ => NoContent(), MapErrorsToResult);
    }

    // ─── Materials ────────────────────────────────────────────────────────────

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<StockMaterialResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListMaterials(
        Guid tenantId,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool lowStockOnly = false,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        ErrorOr<IReadOnlyList<StockMaterialResponse>> result =
            await mediator.Send(new ListStockMaterialsQuery(tenantId, categoryId, lowStockOnly, search), cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{materialId:guid}")]
    [ProducesResponseType(typeof(StockMaterialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMaterial(
        Guid tenantId, Guid materialId, CancellationToken cancellationToken)
    {
        ErrorOr<StockMaterialResponse> result =
            await mediator.Send(new GetStockMaterialQuery(tenantId, materialId), cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(StockMaterialResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateMaterial(
        Guid tenantId,
        [FromBody] CreateStockMaterialRequest request,
        CancellationToken cancellationToken)
    {
        ErrorOr<StockMaterialResponse> result = await mediator.Send(
            new CreateStockMaterialCommand(
                tenantId, request.Code, request.NameAr, request.NameEn, request.CategoryId,
                request.StorageUnit, request.ComponentUnit, request.ConversionFactor,
                request.CostMethod, request.InitialCost,
                request.MinLevel, request.MaxLevel, request.ReorderLevel),
            cancellationToken);

        return result.Match(
            m => CreatedAtAction(nameof(GetMaterial), new { tenantId, materialId = m.Id }, m),
            MapErrorsToResult);
    }

    [HttpPut("{materialId:guid}")]
    [ProducesResponseType(typeof(StockMaterialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMaterial(
        Guid tenantId, Guid materialId,
        [FromBody] UpdateStockMaterialRequest request,
        CancellationToken cancellationToken)
    {
        ErrorOr<StockMaterialResponse> result = await mediator.Send(
            new UpdateStockMaterialCommand(
                tenantId, materialId, request.Code, request.NameAr, request.NameEn, request.CategoryId,
                request.StorageUnit, request.ComponentUnit, request.ConversionFactor,
                request.CostMethod, request.ManualCost,
                request.MinLevel, request.MaxLevel, request.ReorderLevel),
            cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpDelete("{materialId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteMaterial(
        Guid tenantId, Guid materialId, CancellationToken cancellationToken)
    {
        ErrorOr<Success> result =
            await mediator.Send(new DeleteStockMaterialCommand(tenantId, materialId), cancellationToken);
        return result.Match(_ => NoContent(), MapErrorsToResult);
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
