using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Hotel.Application.Commands.ActivateRentalContract;
using NexusPOS.Hotel.Application.Commands.CancelRentalContract;
using NexusPOS.Hotel.Application.Commands.CreateRentalContract;
using NexusPOS.Hotel.Application.Commands.SignRentalContract;
using NexusPOS.Hotel.Application.Commands.UpdateRentalContract;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Application.Queries.GetRentalContract;
using NexusPOS.Hotel.Application.Queries.ListRentalContracts;
using NexusPOS.Hotel.Presentation.Requests;
using NexusPOS.SharedKernel.Application;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Hotel.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/rental-contracts")]
[Produces("application/json")]
[Authorize]
public sealed class RentalContractsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RentalContractResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        Guid branchId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListRentalContractsQuery(branchId, Paging.Page(page), Paging.Size(pageSize)), ct);
        return result.Match(Ok, MapErrors);
    }

    [HttpGet("{contractId:guid}")]
    [ProducesResponseType(typeof(RentalContractResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid branchId, Guid contractId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetRentalContractQuery(contractId, branchId), ct);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost]
    [ProducesResponseType(typeof(RentalContractResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        Guid branchId,
        [FromBody] CreateRentalContractRequest request,
        CancellationToken ct = default)
    {
        var clauses = request.Clauses
            .Select(c => new CreateRentalContractClauseDto(c.Order, c.Title, c.Body))
            .ToList();

        var command = new CreateRentalContractCommand(
            branchId,
            GetTenantId(),
            request.TenantName,
            request.TenantNationalId,
            request.TenantPhone,
            request.RoomNumber,
            request.StartDate,
            request.EndDate,
            request.MonthlyRent,
            request.LandlordName,
            clauses,
            request.ReservationId,
            request.Notes);

        var result = await mediator.Send(command, ct);
        return result.Match(
            contract => CreatedAtAction(nameof(Get), new { branchId, contractId = contract.Id }, contract),
            MapErrors);
    }

    [HttpPut("{contractId:guid}")]
    [ProducesResponseType(typeof(RentalContractResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid branchId,
        Guid contractId,
        [FromBody] CreateRentalContractRequest request,
        CancellationToken ct = default)
    {
        var clauses = request.Clauses
            .Select(c => new CreateRentalContractClauseDto(c.Order, c.Title, c.Body))
            .ToList();

        var command = new UpdateRentalContractCommand(
            contractId,
            branchId,
            request.TenantName,
            request.TenantNationalId,
            request.TenantPhone,
            request.RoomNumber,
            request.StartDate,
            request.EndDate,
            request.MonthlyRent,
            request.LandlordName,
            clauses,
            request.Notes);

        var result = await mediator.Send(command, ct);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost("{contractId:guid}/sign")]
    [ProducesResponseType(typeof(RentalContractResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Sign(Guid branchId, Guid contractId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new SignRentalContractCommand(contractId, branchId), ct);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost("{contractId:guid}/activate")]
    [ProducesResponseType(typeof(RentalContractResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Activate(Guid branchId, Guid contractId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new ActivateRentalContractCommand(contractId, branchId), ct);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost("{contractId:guid}/cancel")]
    [Authorize(Policy = "OwnerOrManager")]
    [ProducesResponseType(typeof(RentalContractResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cancel(Guid branchId, Guid contractId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new CancelRentalContractCommand(contractId, branchId), ct);
        return result.Match(Ok, MapErrors);
    }

    private Guid GetTenantId()
    {
        string? claim = User.FindFirst("tenant_id")?.Value;
        return claim is not null && Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    private IActionResult MapErrors(List<Error> errors) => this.ToProblem(errors);
}
