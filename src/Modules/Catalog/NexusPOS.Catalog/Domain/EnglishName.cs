namespace NexusPOS.Catalog.Domain;

// Catalog names are kept in Arabic (receipts, kitchen tickets and ZATCA use them); the English name is optional and
// only changes what an English-language screen shows. Blank means "none", so screens fall back to the Arabic name.
public static class EnglishName
{
    public const int MaxLength = 256;

    public static string? Normalize(string? name)
    {
        string? trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length > MaxLength ? trimmed[..MaxLength] : trimmed;
    }
}
