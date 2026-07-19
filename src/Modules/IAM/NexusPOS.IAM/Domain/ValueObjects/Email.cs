using ErrorOr;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.IAM.Domain.ValueObjects;

public sealed class Email : ValueObject
{
    public string Value { get; }

    private Email(string value)
    {
        Value = value;
    }

    public static ErrorOr<Email> Create(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return Error.Validation("Email.Empty", "Email cannot be empty.");
        }

        string trimmed = value.Trim().ToLowerInvariant();

        if (trimmed.Length > 256 || !trimmed.Contains('@'))
        {
            return Error.Validation("Email.Invalid", $"'{value}' is not a valid email address.");
        }

        int atIndex = trimmed.IndexOf('@');
        string local = trimmed[..atIndex];
        string domain = trimmed[(atIndex + 1)..];

        if (local.Length == 0 || domain.Length < 3 || !domain.Contains('.'))
        {
            return Error.Validation("Email.Invalid", $"'{value}' is not a valid email address.");
        }

        return new Email(trimmed);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;
}
