using System.Data.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace NexusPOS.SharedKernel.Presentation;

public readonly record struct ExceptionProblem(int StatusCode, string Title, string Detail);

// Turns an unhandled exception into what the client may see. The exception's own message never
// goes out: Npgsql/EF text carries table, index and SQL details, so it stays in the log only.
public static class ExceptionProblems
{
    public const string UnexpectedDetail = "حدث خطأ غير متوقع، حاول مرة أخرى";
    public const string DuplicateDetail = "السجل موجود مسبقاً";
    public const string ConcurrencyDetail = "تم تعديل السجل من مستخدم آخر، حدّث الصفحة";
    public const string InUseDetail = "لا يمكن إتمام العملية لأن السجل مرتبط ببيانات أخرى";
    public const string InvalidDataDetail = "البيانات المدخلة غير صالحة";
    public const string BadRequestDetail = "الطلب غير صالح، راجع البيانات وحاول مرة أخرى";
    public const string ForbiddenDetail = "ليس لديك صلاحية لهذا الإجراء";
    public const string NotFoundDetail = "العنصر المطلوب غير موجود";
    public const string TimeoutDetail = "انتهت مهلة العملية، حاول مرة أخرى";
    public const string OperationFailedDetail = "تعذّر تنفيذ العملية، حاول مرة أخرى";

    private const string UniqueViolation = "23505";
    private const string ForeignKeyViolation = "23503";

    // A cancelled request whose client already went away: nobody is left to answer and nothing failed.
    public static bool IsClientAbort(Exception exception, CancellationToken requestAborted) =>
        exception is OperationCanceledException && requestAborted.IsCancellationRequested;

    public static ExceptionProblem Map(Exception exception) => exception switch
    {
        DbUpdateConcurrencyException => new(StatusCodes.Status409Conflict, "Conflict", ConcurrencyDetail),
        _ when SqlStateOf(exception) == UniqueViolation =>
            new(StatusCodes.Status409Conflict, "Conflict", DuplicateDetail),
        _ when SqlStateOf(exception) == ForeignKeyViolation =>
            new(StatusCodes.Status409Conflict, "Conflict", InUseDetail),
        DomainException domain => new(StatusCodes.Status422UnprocessableEntity, domain.Code, InvalidDataDetail),
        ArgumentException => new(StatusCodes.Status400BadRequest, "Bad Request", BadRequestDetail),
        UnauthorizedAccessException => new(StatusCodes.Status403Forbidden, "Forbidden", ForbiddenDetail),
        KeyNotFoundException => new(StatusCodes.Status404NotFound, "Not Found", NotFoundDetail),
        OperationCanceledException => new(StatusCodes.Status504GatewayTimeout, "Gateway Timeout", TimeoutDetail),
        InvalidOperationException => new(StatusCodes.Status422UnprocessableEntity, "Unprocessable Entity", OperationFailedDetail),
        _ => new(StatusCodes.Status500InternalServerError, "Internal Server Error", UnexpectedDetail),
    };

    // PostgresException is a DbException, so its SqlState is readable without referencing Npgsql here.
    private static string? SqlStateOf(Exception exception) => exception switch
    {
        DbException db => db.SqlState,
        DbUpdateException { InnerException: DbException db } => db.SqlState,
        _ => null,
    };
}
