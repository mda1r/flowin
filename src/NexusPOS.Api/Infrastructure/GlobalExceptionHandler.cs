using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Api.Infrastructure;

internal sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    // Non-standard "client closed request"; only shows up in the request log.
    private const int ClientClosedRequest = 499;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (ExceptionProblems.IsClientAbort(exception, httpContext.RequestAborted))
        {
            logger.LogDebug("Request cancelled by the client on {Method} {Path}",
                httpContext.Request.Method,
                httpContext.Request.Path);

            if (!httpContext.Response.HasStarted)
            {
                httpContext.Response.StatusCode = ClientClosedRequest;
            }

            return true;
        }

        ExceptionProblem problem = ExceptionProblems.Map(exception);

        if (problem.StatusCode >= StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception,
                "Unhandled exception on {Method} {Path}",
                httpContext.Request.Method,
                httpContext.Request.Path);
        }
        else
        {
            logger.LogWarning(exception,
                "Request failed with {StatusCode} on {Method} {Path}",
                problem.StatusCode,
                httpContext.Request.Method,
                httpContext.Request.Path);
        }

        var problemDetails = new ProblemDetails
        {
            Status = problem.StatusCode,
            Title = problem.Title,
            Type = $"https://tools.ietf.org/html/rfc9110#section-15.{problem.StatusCode / 100}",
            Detail = problem.Detail
        };

        problemDetails.Extensions["traceId"] = httpContext.TraceIdentifier;

        httpContext.Response.StatusCode = problem.StatusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }
}
