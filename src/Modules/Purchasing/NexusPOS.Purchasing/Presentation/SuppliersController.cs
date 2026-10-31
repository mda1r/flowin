using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Purchasing.Application.Commands.CreateSupplier;
using NexusPOS.Purchasing.Application.Commands.DeactivateSupplier;
using NexusPOS.Purchasing.Application.Commands.UpdateSupplier;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Application.Queries.GetSupplier;
using NexusPOS.Purchasing.Application.Queries.ListSuppliers;

namespace NexusPOS.Purchasing.Presentation;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/suppliers")]
[Produces("application/json")]
[Authorize]
public sealed class SuppliersController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SupplierResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListSuppliers(
        Guid tenantId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        ListSuppliersQuery query = new(tenantId, page, pageSize);
        ErrorOr<IReadOnlyList<SupplierResponse>> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpGet("{supplierId:guid}")]
    [ProducesResponseType(typeof(SupplierResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSupplier(Guid tenantId, Guid supplierId, CancellationToken cancellationToken)
    {
        GetSupplierQuery query = new(supplierId, tenantId);
        ErrorOr<SupplierResponse> result = await mediator.Send(query, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SupplierResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateSupplier(
        Guid tenantId,
        [FromBody] CreateSupplierRequest request,
        CancellationToken cancellationToken)
    {
        CreateSupplierCommand command = new(tenantId, request.Name, request.ContactEmail, request.ContactPhone, request.Address);
        ErrorOr<SupplierResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            supplier => CreatedAtAction(nameof(GetSupplier), new { tenantId, supplierId = supplier.Id }, supplier),
            MapErrorsToResult);
    }

    [HttpPut("{supplierId:guid}")]
    [ProducesResponseType(typeof(SupplierResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateSupplier(
        Guid tenantId,
        Guid supplierId,
        [FromBody] UpdateSupplierRequest request,
        CancellationToken cancellationToken)
    {
        UpdateSupplierCommand command = new(supplierId, tenantId, request.Name, request.ContactEmail, request.ContactPhone, request.Address);
        ErrorOr<SupplierResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrorsToResult);
    }

    [HttpDelete("{supplierId:guid}")]
    [ProducesResponseType(typeof(SupplierResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateSupplier(Guid tenantId, Guid supplierId, CancellationToken cancellationToken)
    {
        DeactivateSupplierCommand command = new(supplierId, tenantId);
        ErrorOr<SupplierResponse> result = await mediator.Send(command, cancellationToken);
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

public sealed record CreateSupplierRequest(
    string Name,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null);

public sealed record UpdateSupplierRequest(
    string Name,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null);
