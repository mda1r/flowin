using System.Security.Claims;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using NexusPOS.CRM.Application.Marketing;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.CRM.Presentation;

// WhatsApp offers to customers who agreed to receive them. Owners and managers only.
[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/marketing")]
[Produces("application/json")]
[Authorize(Policy = "OwnerOrManager")]
public sealed class MarketingController(ISender mediator) : ControllerBase
{
    [HttpGet("audience")]
    public async Task<IActionResult> Audience(Guid tenantId, CancellationToken ct) =>
        (await mediator.Send(new GetAudienceQuery(tenantId), ct)).Match(Ok, Problem);

    [HttpPost("media")]
    [RequestSizeLimit(4 * 1024 * 1024)]
    public async Task<IActionResult> UploadMedia(Guid tenantId, [FromBody] UploadMediaRequest request, CancellationToken ct) =>
        (await mediator.Send(new UploadMediaCommand(tenantId, request.ContentType, request.Base64), ct)).Match(Ok, Problem);

    [HttpGet("campaigns")]
    public async Task<IActionResult> ListCampaigns(Guid tenantId, CancellationToken ct) =>
        (await mediator.Send(new ListCampaignsQuery(tenantId), ct)).Match(Ok, Problem);

    [HttpGet("campaigns/{campaignId:guid}")]
    public async Task<IActionResult> GetCampaign(Guid tenantId, Guid campaignId, CancellationToken ct) =>
        (await mediator.Send(new GetCampaignQuery(tenantId, campaignId), ct)).Match(Ok, Problem);

    [HttpPost("campaigns")]
    public async Task<IActionResult> CreateCampaign(Guid tenantId, [FromBody] CreateCampaignRequest request, CancellationToken ct)
    {
        Guid? userId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out Guid id) ? id : null;
        CreateCampaignCommand command = new(
            tenantId, userId, request.Message ?? string.Empty, request.ImageId, request.Channel, request.CustomerIds ?? []);
        return (await mediator.Send(command, ct)).Match(Ok, Problem);
    }

    [HttpPost("campaigns/{campaignId:guid}/send-batch")]
    public async Task<IActionResult> SendBatch(
        Guid tenantId, Guid campaignId, [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CampaignRunnerRequest? request, CancellationToken ct)
    {
        Guid? runnerId = request?.RunnerId is Guid id && id != Guid.Empty ? id : null;
        return (await mediator.Send(new SendCampaignBatchCommand(tenantId, campaignId, runnerId), ct)).Match(Ok, Problem);
    }

    [HttpPost("campaigns/{campaignId:guid}/release")]
    public async Task<IActionResult> ReleaseSending(Guid tenantId, Guid campaignId, [FromBody] CampaignRunnerRequest request, CancellationToken ct) =>
        request.RunnerId is Guid runnerId
            ? (await mediator.Send(new ReleaseCampaignSendingCommand(tenantId, campaignId, runnerId), ct)).Match(_ => NoContent(), Problem)
            : NoContent();

    [HttpPost("campaigns/{campaignId:guid}/retry-failed")]
    public async Task<IActionResult> RetryFailed(Guid tenantId, Guid campaignId, CancellationToken ct) =>
        (await mediator.Send(new RetryFailedCommand(tenantId, campaignId), ct)).Match(Ok, Problem);

    [HttpPost("campaigns/{campaignId:guid}/recipients/{recipientId:guid}/sent")]
    public async Task<IActionResult> MarkSent(Guid tenantId, Guid campaignId, Guid recipientId, CancellationToken ct) =>
        (await mediator.Send(new MarkRecipientSentCommand(tenantId, campaignId, recipientId), ct)).Match(Ok, Problem);

    [HttpGet("whatsapp")]
    public async Task<IActionResult> GetWhatsApp(Guid tenantId, CancellationToken ct) =>
        (await mediator.Send(new GetWhatsAppSettingsQuery(tenantId), ct)).Match(Ok, Problem);

    [HttpPut("whatsapp")]
    public async Task<IActionResult> UpdateWhatsApp(Guid tenantId, [FromBody] UpdateWhatsAppSettingsRequest request, CancellationToken ct)
    {
        UpdateWhatsAppSettingsCommand command = new(
            tenantId, request.PhoneNumberId, request.AccessToken, request.TemplateName, request.LanguageCode,
            request.HasImageHeader, request.IncludeNameVariable, request.BusinessAccountId);
        return (await mediator.Send(command, ct)).Match(Ok, Problem);
    }

    [HttpPost("whatsapp/check")]
    public async Task<IActionResult> CheckWhatsApp(Guid tenantId, CancellationToken ct) =>
        (await mediator.Send(new CheckWhatsAppCommand(tenantId), ct)).Match(Ok, Problem);

    [HttpPost("whatsapp/test")]
    public async Task<IActionResult> TestWhatsApp(Guid tenantId, [FromBody] WhatsAppTestRequest request, CancellationToken ct) =>
        (await mediator.Send(new SendWhatsAppTestCommand(tenantId, request.Phone ?? string.Empty, request.Name, request.Message, request.ImageId), ct))
            .Match(Ok, Problem);

    // The WhatsApp provider failing is an upstream error, not ours; everything else uses the shared mapping.
    private IActionResult Problem(List<Error> errors) =>
        errors is [{ Type: ErrorType.Failure } first, ..]
            ? Problem(title: first.Code, detail: first.Description, statusCode: StatusCodes.Status502BadGateway)
            : this.ToProblem(errors);
}

public sealed record UploadMediaRequest(string ContentType, string Base64);

public sealed record CreateCampaignRequest(string? Message, Guid? ImageId, CampaignChannel Channel, IReadOnlyList<Guid>? CustomerIds);

public sealed record UpdateWhatsAppSettingsRequest(
    string PhoneNumberId,
    string? AccessToken,
    string TemplateName,
    string LanguageCode,
    bool HasImageHeader,
    bool IncludeNameVariable,
    string? BusinessAccountId = null);

public sealed record CampaignRunnerRequest(Guid? RunnerId);

public sealed record WhatsAppTestRequest(string? Phone, string? Name, string? Message, Guid? ImageId);
