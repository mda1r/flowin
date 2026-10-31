using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;

namespace NexusPOS.CRM.Infrastructure.WhatsApp;

// A plain mint square, used by the test send when the template needs an image header and no offer image was chosen.
internal static class PlaceholderImage
{
    public const string ContentType = "image/png";

    public static byte[] Png { get; } = Build(400, 400, 94, 214, 180);

    internal static byte[] Build(int width, int height, byte red, byte green, byte blue)
    {
        byte[] row = new byte[1 + (width * 3)];
        for (int x = 0; x < width; x++)
        {
            row[1 + (x * 3)] = red;
            row[2 + (x * 3)] = green;
            row[3 + (x * 3)] = blue;
        }

        using MemoryStream pixels = new();
        using (ZLibStream zlib = new(pixels, CompressionLevel.Optimal, leaveOpen: true))
        {
            for (int y = 0; y < height; y++)
            {
                zlib.Write(row);
            }
        }

        byte[] header = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(header, width);
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), height);
        header[8] = 8; // bits per channel
        header[9] = 2; // RGB

        using MemoryStream png = new();
        png.Write([137, 80, 78, 71, 13, 10, 26, 10]);
        WriteChunk(png, "IHDR", header);
        WriteChunk(png, "IDAT", pixels.ToArray());
        WriteChunk(png, "IEND", []);
        return png.ToArray();
    }

    private static void WriteChunk(Stream png, string type, byte[] data)
    {
        byte[] typeBytes = Encoding.ASCII.GetBytes(type);
        Span<byte> number = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(number, data.Length);
        png.Write(number);
        png.Write(typeBytes);
        png.Write(data);
        BinaryPrimitives.WriteUInt32BigEndian(number, Crc32([.. typeBytes, .. data]));
        png.Write(number);
    }

    private static uint Crc32(byte[] bytes)
    {
        uint crc = 0xFFFFFFFF;
        foreach (byte b in bytes)
        {
            crc ^= b;
            for (int k = 0; k < 8; k++)
            {
                crc = (crc & 1) != 0 ? 0xEDB88320 ^ (crc >> 1) : crc >> 1;
            }
        }

        return ~crc;
    }
}
