using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.CRM.Application.Marketing;

namespace NexusPOS.CRM.Presentation;

// Offer images opened by WhatsApp and by customers' phones; no sign-in, the random id is the key.
[ApiController]
[Route("api/v1/public/media")]
[AllowAnonymous]
public sealed class PublicMediaController(ISender mediator) : ControllerBase
{
    [HttpGet("{id:guid}")]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        ErrorOr<PublicMedia> media = await mediator.Send(new GetPublicMediaQuery(id), ct);
        return media.IsError ? NotFound() : File(media.Value.Data, media.Value.ContentType);
    }
}
