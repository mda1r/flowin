using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Marketing;

namespace NexusPOS.CRM.Infrastructure.Persistence.Repositories;

// How a search for a customer is matched against phones, however the number was typed (Arabic-Indic digits, +966, 05…).
// New phones are stored normalised (see Customer.CleanPhone); rows saved before that keep what was typed, so the raw
// text still matches as it always did. There is deliberately no SQL patch rewriting old rows: normalising phones in SQL
// is error-prone, and these terms find them anyway.
internal sealed record CustomerSearch(string Text, string Digits, string Key, string[] ExactPhones)
{
    public static CustomerSearch Parse(string search)
    {
        string text = search.Trim();
        string ascii = WhatsAppPhone.ToAsciiDigits(text);
        string digits = new([.. ascii.Where(char.IsAsciiDigit)]);

        // Only a search that looks like a phone gets the digit terms; "محمد 2" stays a name search.
        if (digits.Length == 0 || !ascii.All(c => char.IsAsciiDigit(c) || c is ' ' or '+' or '-' or '(' or ')'))
        {
            return new CustomerSearch(text, text, text, []);
        }

        string? normalized = WhatsAppPhone.Normalize(text);
        string key = normalized ?? PartialKey(digits);
        string[] exact = normalized is null ? [ascii] : [.. WhatsAppPhone.StoredForms(normalized)];
        return new CustomerSearch(text, digits, key, exact);
    }

    // The start of a number as it is stored: "0501" is the start of 966501…, "00966" of 966…
    // Too short a prefix would match almost every number, so it stays as typed.
    private static string PartialKey(string digits)
    {
        if (digits.Length < 4)
        {
            return digits;
        }

        if (digits.StartsWith("00", StringComparison.Ordinal))
        {
            return digits[2..];
        }

        return digits[0] == '0' ? "966" + digits[1..] : digits;
    }

    // A customer whose phone is exactly the number searched comes first, then the usual name order.
    public IOrderedQueryable<Customer> ExactPhoneFirst(IQueryable<Customer> query)
    {
        string[] exact = ExactPhones;
        return query
            .OrderBy(c => c.Phone != null && exact.Contains(c.Phone) ? 0 : 1)
            .ThenBy(c => c.Name);
    }
}
