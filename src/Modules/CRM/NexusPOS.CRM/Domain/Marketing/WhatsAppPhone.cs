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

        string raw = ToAsciiDigits(input.Trim());
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

    // Arabic-Indic (٠-٩) and Persian (۰-۹) digits, which Arabic keyboards type, become 0-9; everything else is kept.
    public static string ToAsciiDigits(string input) =>
        string.Create(input.Length, input, static (span, source) =>
        {
            for (int i = 0; i < source.Length; i++)
            {
                char c = source[i];
                span[i] = c switch
                {
                    >= '\u0660' and <= '\u0669' => (char)('0' + (c - '\u0660')),
                    >= '\u06F0' and <= '\u06F9' => (char)('0' + (c - '\u06F0')),
                    _ => c,
                };
            }
        });

    // The ways a normalised number may be stored: +9665XXXXXXXX as customers save it now, and in rows saved before that
    // 9665XXXXXXXX, 009665XXXXXXXX, 05XXXXXXXX or 5XXXXXXXX for a Saudi mobile.
    public static IReadOnlyList<string> StoredForms(string normalized)
    {
        List<string> forms = [normalized, "+" + normalized, "00" + normalized];
        if (normalized.Length == 12 && normalized.StartsWith("9665", StringComparison.Ordinal))
        {
            forms.Add("0" + normalized[3..]);
            forms.Add(normalized[3..]);
        }

        return forms;
    }
}
