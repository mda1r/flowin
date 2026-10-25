using System.Collections;
using System.Reflection;
using MediatR;
using Microsoft.Extensions.Logging;

namespace NexusPOS.SharedKernel.Application.Behaviors;

public sealed class LoggingBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        string requestName = typeof(TRequest).Name;

        _logger.LogInformation(
            "Handling {RequestName} {@Request}",
            requestName, LogRedactor.Describe(request));

        var response = await next();

        _logger.LogInformation(
            "Handled {RequestName} — {@Response}",
            requestName, LogRedactor.Describe(response));

        return response;
    }
}

// Turns a request or response into a loggable shape without secrets: passwords, tokens, keys and uploaded
// file contents are replaced, and long lists are summarised so one big command cannot flood the logs.
public static class LogRedactor
{
    private const string Redacted = "***";
    private const int MaxDepth = 4;
    private const int MaxItems = 10;
    private const int MaxText = 500;

    private static readonly string[] _sensitive =
        ["password", "token", "secret", "apikey", "privatekey", "certificate", "base64", "otp", "pin", "cvv", "cardnumber"];

    public static object? Describe(object? value) => Describe(value, 0);

    public static bool IsSensitive(string propertyName)
    {
        string name = propertyName.Replace("_", string.Empty, StringComparison.Ordinal);
        return _sensitive.Any(s => name.Contains(s, StringComparison.OrdinalIgnoreCase));
    }

    private static object? Describe(object? value, int depth)
    {
        switch (value)
        {
            case null:
                return null;
            case string s:
                return s.Length > MaxText ? s[..MaxText] + "…" : s;
            case byte[] bytes:
                return $"[{bytes.Length} bytes]";
            case Enum or Guid or DateTime or DateTimeOffset or DateOnly or TimeOnly or TimeSpan or decimal or bool:
                return value;
        }

        Type type = value.GetType();
        if (type.IsPrimitive)
        {
            return value;
        }

        if (depth >= MaxDepth)
        {
            return type.Name;
        }

        if (value is IEnumerable items)
        {
            List<object?> list = [];
            int count = 0;
            foreach (object? item in items)
            {
                if (count++ < MaxItems)
                {
                    list.Add(Describe(item, depth + 1));
                }
            }

            if (count > MaxItems)
            {
                list.Add($"… {count - MaxItems} more");
            }

            return list;
        }

        Dictionary<string, object?> shape = [];
        foreach (PropertyInfo property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.GetIndexParameters().Length > 0 || property.Name == "EqualityContract")
            {
                continue;
            }

            if (IsSensitive(property.Name))
            {
                shape[property.Name] = Redacted;
                continue;
            }

            try
            {
                shape[property.Name] = Describe(property.GetValue(value), depth + 1);
            }
            catch (TargetInvocationException)
            {
                // Some getters throw by design (ErrorOr.FirstError on a success); leave them out.
            }
        }

        return shape;
    }
}
