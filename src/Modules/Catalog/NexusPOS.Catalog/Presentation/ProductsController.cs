using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Catalog.Application.Commands.AddProductVariant;
using NexusPOS.Catalog.Application.Commands.CreateProduct;
using NexusPOS.Catalog.Application.Commands.DeactivateProduct;
using NexusPOS.Catalog.Application.Commands.UpdateProduct;
using NexusPOS.Catalog.Application.Commands.UpdateVariant;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Queries.GetProductById;
using NexusPOS.Catalog.Application.Queries.ListProducts;
using NexusPOS.Catalog.Presentation.Requests;

namespace NexusPOS.Catalog.Presentation;

[ApiController]
[Route("api/v1/products")]
[Produces("application/json")]
[Authorize]
public sealed class ProductsController(ISender mediator) : ControllerBase
{
    /// <summary>List products, optionally filtered by category or text search.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ProductResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListProducts(
        [FromQuery] Guid? categoryId,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        ListProductsQuery query = new(categoryId, search);
        ErrorOr<IReadOnlyList<ProductResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get a product by ID, including all its variants.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProduct(Guid id, CancellationToken cancellationToken)
    {
        GetProductByIdQuery query = new(id);
        ErrorOr<ProductResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Create a new product with an initial variant.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateProduct(
        [FromBody] CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        CreateProductCommand command = new(
            request.Name, request.Description, request.CategoryId,
            request.Type, request.TaxClass, request.TrackInventory,
            request.Sku, request.VariantName,
            request.CostPrice, request.SalePrice, request.Currency, request.Barcode, request.ExpiryDate);

        ErrorOr<ProductResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            product => CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product),
            MapErrorsToResult);
    }

    /// <summary>Update a product's name, description, category and pricing settings.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateProduct(
        Guid id,
        [FromBody] UpdateProductRequest request,
        CancellationToken cancellationToken)
    {
        UpdateProductCommand command = new(
            id, request.Name, request.Description, request.CategoryId,
            request.TaxClass, request.TrackInventory, request.ImageUrl);

        ErrorOr<ProductResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Update a variant's name, pricing, and barcode.</summary>
    [HttpPatch("{id:guid}/variants/{variantId:guid}")]
    [ProducesResponseType(typeof(ProductVariantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateVariant(
        Guid id,
        Guid variantId,
        [FromBody] UpdateVariantRequest request,
        CancellationToken cancellationToken)
    {
        UpdateVariantCommand command = new(
            id, variantId, request.Name, request.CostPrice, request.SalePrice, request.Currency, request.Barcode);

        ErrorOr<ProductVariantResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Add a variant (SKU) to an existing product.</summary>
    [HttpPost("{id:guid}/variants")]
    [ProducesResponseType(typeof(ProductVariantResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddVariant(
        Guid id,
        [FromBody] AddVariantRequest request,
        CancellationToken cancellationToken)
    {
        AddProductVariantCommand command = new(
            id, request.Sku, request.Name,
            request.CostPrice, request.SalePrice, request.Currency, request.Barcode, request.ExpiryDate);

        ErrorOr<ProductVariantResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            variant => CreatedAtAction(nameof(GetProduct), new { id }, variant),
            MapErrorsToResult);
    }

    /// <summary>Deactivate a product and all its variants.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateProduct(Guid id, CancellationToken cancellationToken)
    {
        DeactivateProductCommand command = new(id);
        ErrorOr<Success> result = await mediator.Send(command, cancellationToken);

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
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}
