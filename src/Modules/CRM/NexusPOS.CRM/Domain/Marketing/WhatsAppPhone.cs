namespace NexusPOS.CRM.Domain.Marketing;

// Same rules as the till's frontend helper: Saudi mobiles in any common form become 9665XXXXXXXX;
// other countries are accepted when written internationally with + or 00.
public static class WhatsAppPhone
{
    public static string? Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        string raw = input.Trim();
        bool international = raw.StartsWith('+') || raw.StartsWith("00", StringComparison.Ordinal);
        string digits = new([.. raw.Where(char.IsAsciiDigit)]);
        if (digits.StartsWith("00", StringComparison.Ordinal))
        {
            digits = digits[2..];
        }

        if (digits.Length == 10 && digits.StartsWith("05", StringComparison.Ordinal))
        {
            return "966" + digits[1..];
        }

        if (digits.Length == 9 && digits[0] == '5')
        {
            return "966" + digits;
        }

        if (digits.Length == 12 && digits.StartsWith("9665", StringComparison.Ordinal))
        {
            return digits;
        }

        return international && digits.Length is >= 8 and <= 15 ? digits : null;
    }
}
