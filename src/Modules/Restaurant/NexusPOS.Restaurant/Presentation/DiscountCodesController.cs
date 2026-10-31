using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Application.Queries.ListDiscountCodes;
using NexusPOS.Restaurant.Application.Queries.ValidateDiscountCode;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/restaurant/discounts")]
[Produces("application/json")]
[Authorize]
public sealed class DiscountCodesController(ISender mediator, ITenantContext tenantContext) : ControllerBase
{
    /// <summary>List all discount codes for the tenant.</summary>
    [HttpGet]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(IReadOnlyList<DiscountCodeResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListDiscountCodes(CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Unauthorized();
        }

        ListDiscountCodesQuery query = new(tenantId);
        ErrorOr<IReadOnlyList<DiscountCodeResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Validate a discount code and get the computed discount amount.</summary>
    [HttpGet("validate")]
    [ProducesResponseType(typeof(ValidateDiscountCodeResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ValidateDiscountCode(
        [FromQuery] string code,
        [FromQuery] decimal orderAmount,
        CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Unauthorized();
        }

        ValidateDiscountCodeQuery query = new(tenantId, code, orderAmount);
        ErrorOr<ValidateDiscountCodeResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Create a new discount code.</summary>
    [HttpPost]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(DiscountCodeResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateDiscountCode(
        Guid branchId,
        [FromBody] CreateDiscountCodeRequest request,
        CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Unauthorized();
        }

        CreateDiscountCodeCommand command = new(
            tenantId,
            request.Code,
            request.Type,
            request.Value,
            request.MinOrderAmount,
            request.MaxUses,
            request.ExpiryDate);

        ErrorOr<DiscountCodeResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            code => CreatedAtAction(nameof(ValidateDiscountCode),
                new { branchId, code = code.Code, orderAmount = 0 }, code),
            MapErrors);
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

public sealed record CreateDiscountCodeRequest(
    string Code,
    DiscountCodeType Type,
    decimal Value,
    decimal MinOrderAmount,
    int MaxUses,
    DateTime ExpiryDate);
