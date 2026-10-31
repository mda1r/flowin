using FluentAssertions;
using NexusPOS.POS.Application.Commands.ReturnOrder;
using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class ReturnOrderCommandValidatorTests
{
    private static ReturnOrderCommand Command(Guid? reference) =>
        new(Guid.NewGuid(), Guid.NewGuid(), RefundMethod.Cash,
            [new(Guid.NewGuid(), 1m, ReturnReason.CustomerRequest)], ClientReference: reference);

    [Fact]
    public void RejectsAnEmptyClientReference() =>
        new ReturnOrderCommandValidator().Validate(Command(Guid.Empty)).IsValid.Should().BeFalse();

    [Fact]
    public void AcceptsAMissingOrRealClientReference()
    {
        ReturnOrderCommandValidator validator = new();

        validator.Validate(Command(null)).IsValid.Should().BeTrue();
        validator.Validate(Command(Guid.NewGuid())).IsValid.Should().BeTrue();
    }
}
