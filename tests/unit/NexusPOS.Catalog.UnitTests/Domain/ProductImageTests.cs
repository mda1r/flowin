using FluentAssertions;
using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class ProductImageTests
{
    [Fact]
    public void Sniff_RecognisesJpegPngAndWebp()
    {
        ProductImage.SniffContentType([0xFF, 0xD8, 0xFF, 0xE0]).Should().Be("image/jpeg");
        ProductImage.SniffContentType([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]).Should().Be("image/png");
        ProductImage.SniffContentType("RIFF\0\0\0\0WEBPVP8 "u8.ToArray()).Should().Be("image/webp");
    }

    [Fact]
    public void Sniff_RefusesAnythingElse()
    {
        ProductImage.SniffContentType("<svg onload=alert(1)>"u8.ToArray()).Should().BeNull();
        ProductImage.SniffContentType("GIF89a"u8.ToArray()).Should().BeNull();
        ProductImage.SniffContentType([]).Should().BeNull();
    }

    [Fact]
    public void Url_PointsAtThePublicMediaRoute()
    {
        Guid id = Guid.NewGuid();
        ProductImage.UrlFor(id).Should().Be($"/api/v1/media/products/{id}");
    }
}
