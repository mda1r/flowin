using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Sales.Application.Commands.AiChat;
using NexusPOS.Sales.Application.Queries.GetAiInsights;
using NexusPOS.Sales.Presentation.Requests;

namespace NexusPOS.Sales.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/ai")]
[Produces("application/json")]
[Authorize]
public sealed class AiController(ISender mediator) : ControllerBase
{
    /// <summary>مساعد الذكاء الاصطناعي - محادثة</summary>
    [HttpPost("chat")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    public async Task<IActionResult> Chat(
        Guid branchId,
        [FromBody] AiChatRequest request,
        CancellationToken cancellationToken)
    {
        var command = new AiChatCommand(
            branchId,
            request.Message,
            request.History ?? []);

        var result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>رؤى الذكاء الاصطناعي عن المبيعات</summary>
    [HttpGet("insights")]
    [ProducesResponseType(typeof(AiInsightsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInsights(
        Guid branchId,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetAiInsightsQuery(branchId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    private IActionResult MapErrors(List<Error> errors)
    {
        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}
