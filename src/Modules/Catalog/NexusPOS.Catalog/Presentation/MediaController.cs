using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Presentation;

// Serves product photos to <img> tags, which cannot send a token. A photo is public by design (it is shown on the
// shop's own screens and receipts); its address is a random id that changes on every upload, so it is cached
// for a year and never guessed from another shop's.
[ApiController]
[Route("api/v1/media/products")]
[AllowAnonymous]
public sealed class MediaController(CatalogMediaDbContext media) : ControllerBase
{
    [HttpGet("{imageId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductImage(Guid imageId, CancellationToken cancellationToken)
    {
        var image = await media.ProductImages
            .AsNoTracking()
            .Where(i => i.Id == imageId)
            .Select(i => new { i.ContentType, i.Data })
            .FirstOrDefaultAsync(cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(image.Data, image.ContentType);
    }
}
