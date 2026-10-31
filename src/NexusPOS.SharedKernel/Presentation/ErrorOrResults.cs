using ErrorOr;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace NexusPOS.SharedKernel.Presentation;

// One ErrorOr -> ProblemDetails mapping for every controller, so no ErrorType silently becomes a 500.
public static class ErrorOrResults
{
    public static int StatusCodeFor(Error error) => error.Type switch
    {
        ErrorType.Validation => StatusCodes.Status400BadRequest,
        ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
        ErrorType.Forbidden => StatusCodes.Status403Forbidden,
        ErrorType.NotFound => StatusCodes.Status404NotFound,
        ErrorType.Conflict => StatusCodes.Status409Conflict,
        ErrorType.Failure or ErrorType.Unexpected => StatusCodes.Status500InternalServerError,
        // Error.Custom(429, ...) and friends carry their HTTP status as the numeric type.
        _ when error.NumericType is >= 400 and <= 599 => error.NumericType,
        _ => StatusCodes.Status500InternalServerError,
    };

    public static IActionResult ToProblem(this ControllerBase controller, List<Error> errors)
    {
        ArgumentNullException.ThrowIfNull(controller);

        if (errors is not { Count: > 0 })
        {
            return controller.Problem(statusCode: StatusCodes.Status500InternalServerError);
        }

        // All field errors go back together, grouped by property, so a form can flag each one.
        if (errors.TrueForAll(e => e.Type == ErrorType.Validation))
        {
            ModelStateDictionary modelState = new();
            foreach (Error error in errors)
            {
                modelState.AddModelError(error.Code, error.Description);
            }

            return controller.ValidationProblem(
                detail: errors[0].Description,
                statusCode: StatusCodes.Status400BadRequest,
                modelStateDictionary: modelState);
        }

        Error first = errors.Find(e => e.Type != ErrorType.Validation);
        return controller.Problem(title: first.Code, detail: first.Description, statusCode: StatusCodeFor(first));
    }
}
