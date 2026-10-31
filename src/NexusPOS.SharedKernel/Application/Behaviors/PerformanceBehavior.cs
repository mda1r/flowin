using System.Diagnostics;
using MediatR;
using Microsoft.Extensions.Logging;

namespace NexusPOS.SharedKernel.Application.Behaviors;

public sealed class PerformanceBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private const int WarningThresholdMs = 500;
    private const int CriticalThresholdMs = 1500;

    private readonly ILogger<PerformanceBehavior<TRequest, TResponse>> _logger;

    public PerformanceBehavior(ILogger<PerformanceBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();

        var response = await next();

        sw.Stop();
        long elapsed = sw.ElapsedMilliseconds;
        string handlerName = typeof(TRequest).Name;

        if (elapsed > CriticalThresholdMs)
        {
            _logger.LogCritical(
                "PERF_CRITICAL {Handler} took {Elapsed}ms — exceeds {Threshold}ms performance budget. Request: {@Request}",
                handlerName, elapsed, CriticalThresholdMs, request);
        }
        else if (elapsed > WarningThresholdMs)
        {
            _logger.LogWarning(
                "PERF_WARNING {Handler} took {Elapsed}ms",
                handlerName, elapsed);
        }

        return response;
    }
}
