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
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Restaurant.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/restaurant/discounts")]
[Produces("application/json")]
[Authorize]
public sealed class DiscountCodesController(ISender mediator) : ControllerBase
{
    /// <summary>List all discount codes for the tenant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<DiscountCodeResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListDiscountCodes(
        [FromQuery] Guid tenantId,
        CancellationToken cancellationToken)
    {
        ListDiscountCodesQuery query = new(tenantId);
        ErrorOr<IReadOnlyList<DiscountCodeResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>Validate a discount code and get the computed discount amount.</summary>
    [HttpGet("validate")]
    [ProducesResponseType(typeof(ValidateDiscountCodeResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ValidateDiscountCode(
        [FromQuery] Guid tenantId,
        [FromQuery] string code,
        [FromQuery] decimal orderAmount,
        CancellationToken cancellationToken)
    {
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
        CreateDiscountCodeCommand command = new(
            request.TenantId,
            request.Code,
            request.Type,
            request.Value,
            request.MinOrderAmount,
            request.MaxUses,
            request.ExpiryDate);

        ErrorOr<DiscountCodeResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            code => CreatedAtAction(nameof(ValidateDiscountCode),
                new { branchId, tenantId = code.TenantId, code = code.Code, orderAmount = 0 }, code),
            MapErrors);
    }

    private IActionResult MapErrors(List<Error> errors) => this.ToProblem(errors);
}

public sealed record CreateDiscountCodeRequest(
    Guid TenantId,
    string Code,
    DiscountCodeType Type,
    decimal Value,
    decimal MinOrderAmount,
    int MaxUses,
    DateTime ExpiryDate);
