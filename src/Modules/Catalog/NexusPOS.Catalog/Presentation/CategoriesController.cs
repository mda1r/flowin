using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Catalog.Application.Commands.CreateCategory;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Queries.ListCategories;
using NexusPOS.Catalog.Presentation.Requests;

namespace NexusPOS.Catalog.Presentation;

[ApiController]
[Route("api/v1/categories")]
[Produces("application/json")]
[Authorize]
public sealed class CategoriesController(ISender mediator) : ControllerBase
{
    /// <summary>List all categories.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCategories(CancellationToken cancellationToken)
    {
        ListCategoriesQuery query = new();
        ErrorOr<IReadOnlyList<CategoryResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Create a new product category.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CategoryResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateCategory(
        [FromBody] CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        CreateCategoryCommand command = new(
            request.Name, request.Description, request.ParentId, request.SortOrder);

        ErrorOr<CategoryResponse> result = await mediator.Send(command, cancellationToken);

        return result.Match(
            category => CreatedAtAction(nameof(ListCategories), new { id = category.Id }, category),
            MapErrorsToResult);
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
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}
