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
            requestName, request);

        var response = await next();

        _logger.LogInformation(
            "Handled {RequestName} — {@Response}",
            requestName, response);

        return response;
    }
}
