using System.Text;

namespace NexusPOS.Zatca.Application.Services;

public static class ZatcaQrService
{
    public static string GenerateQrBase64(
        string sellerName,
        string vatRegistrationNumber,
        DateTime invoiceDateTime,
        decimal totalWithVat,
        decimal vatAmount)
    {
        using var stream = new MemoryStream();

        WriteTlv(stream, 1, sellerName);
        WriteTlv(stream, 2, vatRegistrationNumber);
        WriteTlv(stream, 3, invoiceDateTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"));
        WriteTlv(stream, 4, totalWithVat.ToString("F2"));
        WriteTlv(stream, 5, vatAmount.ToString("F2"));

        return Convert.ToBase64String(stream.ToArray());
    }

    private static void WriteTlv(Stream stream, byte tag, string value)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(value);
        stream.WriteByte(tag);
        stream.WriteByte((byte)bytes.Length);
        stream.Write(bytes, 0, bytes.Length);
    }
}
