using ErrorOr;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using NexusPOS.SharedKernel.Application.Behaviors;

namespace NexusPOS.SharedKernel.UnitTests.Application;

public sealed class ValidationLanguageTests
{
    public sealed record SampleCommand(string Name, string ZoneLabel);

    private sealed class SampleValidator : AbstractValidator<SampleCommand>
    {
        public SampleValidator()
        {
            RuleFor(x => x.Name).NotEmpty();
            RuleFor(x => x.ZoneLabel).NotEmpty();
        }
    }

    [Fact]
    public void DefaultMessages_AreArabic_AndKeepThePropertyPathAsTheKey()
    {
        ValidationLanguage.UseArabic();

        ValidationResult result = new SampleValidator().Validate(new SampleCommand(string.Empty, string.Empty));

        ValidationFailure name = result.Errors.Single(e => e.PropertyName == nameof(SampleCommand.Name));
        name.ErrorMessage.Should().Contain("الاسم").And.NotContain("must not be empty");

        // A field with no Arabic name still gets the Arabic sentence around FluentValidation's own name.
        ValidationFailure zone = result.Errors.Single(e => e.PropertyName == nameof(SampleCommand.ZoneLabel));
        zone.ErrorMessage.Should().NotContain("must not be empty");
    }

    [Fact]
    public void FieldName_FallsBackToNullForUnknownMembers()
    {
        ValidationLanguage.FieldName(typeof(SampleCommand).GetProperty(nameof(SampleCommand.Name))).Should().Be("الاسم");
        ValidationLanguage.FieldName(typeof(SampleCommand).GetProperty(nameof(SampleCommand.ZoneLabel))).Should().BeNull();
        ValidationLanguage.FieldName(null).Should().BeNull();
    }

    private sealed record Ping(string Name) : MediatR.IRequest<ErrorOr<Success>>;

    private sealed class PingValidator : AbstractValidator<Ping>
    {
        public PingValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("الاسم مطلوب");
        }
    }

    [Fact]
    public async Task ValidationBehavior_ReturnsEachFieldErrorOnce()
    {
        // Two validators registered for the same request flag the same field with the same text.
        ValidationBehavior<Ping, ErrorOr<Success>> behavior = new([new PingValidator(), new PingValidator()]);

        ErrorOr<Success> result = await behavior.Handle(
            new Ping(string.Empty),
            () => Task.FromResult<ErrorOr<Success>>(Result.Success),
            CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.Errors.Should().ContainSingle()
            .Which.Should().Match<Error>(e => e.Code == "Name" && e.Description == "الاسم مطلوب" && e.Type == ErrorType.Validation);
    }
}
