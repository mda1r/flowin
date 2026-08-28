using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Sales.Application.Commands.AiCashier;
using NexusPOS.Sales.Application.Commands.AiChat;
using NexusPOS.Sales.Application.Queries.GetAiInsights;
// using NexusPOS.Sales.Application.Services; // moved to SharedKernel
using NexusPOS.Sales.Presentation.Requests;
using NexusPOS.SharedKernel.Application.Services;
using System.Security.Claims;

namespace NexusPOS.Sales.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/ai")]
[Produces("application/json")]
[Authorize]
public sealed class AiController(ISender mediator, ITenantSubscriptionChecker subscriptionChecker) : ControllerBase
{
    private Guid CurrentTenantId =>
        Guid.TryParse(User.FindFirstValue("tenant_id"), out Guid id) ? id : Guid.Empty;

    /// <summary>التحقق من توفر كاشير AI للمستأجر الحالي</summary>
    [HttpGet("cashier/available")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> CashierAvailable(CancellationToken cancellationToken)
    {
        IReadOnlyList<string> features = await subscriptionChecker.GetFeaturesAsync(CurrentTenantId, cancellationToken);
        return Ok(new { available = features.Contains("ai_cashier") });
    }

    /// <summary>كاشير AI - محادثة صوتية</summary>
    [HttpPost("cashier")]
    [ProducesResponseType(typeof(AiCashierResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status402PaymentRequired)]
    public async Task<IActionResult> Cashier(
        Guid branchId,
        [FromBody] AiCashierRequest request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> features = await subscriptionChecker.GetFeaturesAsync(CurrentTenantId, cancellationToken);
        if (!features.Contains("ai_cashier"))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new
            {
                code = "feature_not_available",
                message = "كاشير AI ميزة حصرية. يرجى التواصل مع الإدارة لتفعيل الاشتراك.",
            });
        }

        var command = new AiCashierCommand(
            branchId,
            request.Messages.Select(m => new ClaudeMessage(m.Role, m.Content)).ToList());

        ErrorOr<AiCashierResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }


    /// <summary>مساعد الذكاء الاصطناعي - محادثة</summary>
    [HttpPost("chat")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status402PaymentRequired)]
    public async Task<IActionResult> Chat(
        Guid branchId,
        [FromBody] AiChatRequest request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> features = await subscriptionChecker.GetFeaturesAsync(CurrentTenantId, cancellationToken);
        if (!features.Contains("ai"))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new { code = "feature_not_available", message = "ميزة الذكاء الاصطناعي غير مفعّلة لهذا الحساب." });
        }

        var command = new AiChatCommand(branchId, request.Message, request.History ?? []);
        var result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>رؤى الذكاء الاصطناعي عن المبيعات</summary>
    [HttpGet("insights")]
    [ProducesResponseType(typeof(AiInsightsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status402PaymentRequired)]
    public async Task<IActionResult> GetInsights(
        Guid branchId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> features = await subscriptionChecker.GetFeaturesAsync(CurrentTenantId, cancellationToken);
        if (!features.Contains("ai"))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new { code = "feature_not_available", message = "ميزة الذكاء الاصطناعي غير مفعّلة لهذا الحساب." });
        }

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
