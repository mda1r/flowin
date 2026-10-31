using ErrorOr;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.SharedKernel.UnitTests.Presentation;

public sealed class ErrorOrResultsTests
{
    private sealed class TestController : ControllerBase;

    private static ObjectResult Map(params Error[] errors) =>
        (ObjectResult)new TestController().ToProblem([.. errors]);

    [Theory]
    [InlineData(ErrorType.NotFound, 404)]
    [InlineData(ErrorType.Conflict, 409)]
    [InlineData(ErrorType.Unauthorized, 401)]
    [InlineData(ErrorType.Forbidden, 403)]
    [InlineData(ErrorType.Failure, 500)]
    [InlineData(ErrorType.Unexpected, 500)]
    public void NonValidationErrors_MapToTheirStatus(ErrorType type, int expected)
    {
        Error error = type switch
        {
            ErrorType.NotFound => Error.NotFound("X.NotFound", "غير موجود"),
            ErrorType.Conflict => Error.Conflict("X.Conflict", "تعارض"),
            ErrorType.Unauthorized => Error.Unauthorized("Gaming.NoTenant", "سجّل الدخول"),
            ErrorType.Forbidden => Error.Forbidden("X.Forbidden", "ممنوع"),
            ErrorType.Failure => Error.Failure("X.Failure", "فشل"),
            _ => Error.Unexpected("X.Unexpected", "خطأ"),
        };

        ObjectResult result = Map(error);

        result.StatusCode.Should().Be(expected);
        ProblemDetails details = result.Value.Should().BeAssignableTo<ProblemDetails>().Subject;
        details.Title.Should().Be(error.Code);
        details.Detail.Should().Be(error.Description);
    }

    [Fact]
    public void CustomNumericType_UsesThatStatus()
    {
        ObjectResult result = Map(Error.Custom(429, "IAM.TooManyRequests", "محاولات كثيرة"));

        result.StatusCode.Should().Be(429);
    }

    [Fact]
    public void ValidationErrors_ReturnEveryFieldError()
    {
        ObjectResult result = Map(
            Error.Validation("Name", "الاسم مطلوب"),
            Error.Validation("Price", "السعر يجب أن يكون أكبر من صفر"),
            Error.Validation("Price", "السعر كبير جداً"));

        result.StatusCode.Should().Be(400);
        ValidationProblemDetails details = result.Value.Should().BeOfType<ValidationProblemDetails>().Subject;
        details.Errors.Should().ContainKey("Name").WhoseValue.Should().Equal("الاسم مطلوب");
        details.Errors.Should().ContainKey("Price").WhoseValue.Should().HaveCount(2);
        details.Detail.Should().Be("الاسم مطلوب");
    }

    [Fact]
    public void MixedErrors_UseTheFirstNonValidationError()
    {
        ObjectResult result = Map(
            Error.Validation("Name", "الاسم مطلوب"),
            Error.NotFound("Catalog.ProductNotFound", "المنتج غير موجود"));

        result.StatusCode.Should().Be(404);
        ((ProblemDetails)result.Value!).Title.Should().Be("Catalog.ProductNotFound");
    }
}
