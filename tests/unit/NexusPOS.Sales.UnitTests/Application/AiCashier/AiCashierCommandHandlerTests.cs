using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.Sales.Application.Commands.AiCashier;
using NexusPOS.Sales.Application.Services;

namespace NexusPOS.Sales.UnitTests.Application.AiCashier;

public sealed class AiCashierCommandHandlerTests
{
    // ── ParseResponse (internal static) ──────────────────────────────

    [Fact]
    public void ParseResponse_ValidGreetingJson_ReturnsCorrectResponse()
    {
        const string json = """{"message":"أهلاً! أنا سعد، ايش تطلب؟","actions":[],"state":"greeting"}""";

        AiCashierResponse result = AiCashierCommandHandler.ParseResponse(json);

        result.Message.Should().Be("أهلاً! أنا سعد، ايش تطلب؟");
        result.State.Should().Be("greeting");
        result.Actions.Should().BeEmpty();
    }

    [Fact]
    public void ParseResponse_AddItemAction_ReturnsActionWithCorrectFields()
    {
        var variantId = Guid.NewGuid();
        string json = $$"""{"message":"تمام!","actions":[{"type":"add_item","variantId":"{{variantId}}","quantity":2,"notes":"بدون سكر"}],"state":"taking_order"}""";

        AiCashierResponse result = AiCashierCommandHandler.ParseResponse(json);

        result.Actions.Should().HaveCount(1);
        AiCashierAction action = result.Actions[0];
        action.Type.Should().Be("add_item");
        action.VariantId.Should().Be(variantId.ToString());
        action.Quantity.Should().Be(2);
        action.Notes.Should().Be("بدون سكر");
        result.State.Should().Be("taking_order");
    }

    [Fact]
    public void ParseResponse_CompleteOrderCash_ReturnsCorrectPaymentMethod()
    {
        const string json = """{"message":"شكراً!","actions":[{"type":"complete_order","paymentMethod":"Cash"}],"state":"complete"}""";

        AiCashierResponse result = AiCashierCommandHandler.ParseResponse(json);

        result.Actions.Should().HaveCount(1);
        result.Actions[0].Type.Should().Be("complete_order");
        result.Actions[0].PaymentMethod.Should().Be("Cash");
        result.State.Should().Be("complete");
    }

    [Fact]
    public void ParseResponse_CompleteOrderCard_ReturnsCorrectPaymentMethod()
    {
        const string json = """{"message":"شكراً على طلبك!","actions":[{"type":"complete_order","paymentMethod":"Card"}],"state":"complete"}""";

        AiCashierResponse result = AiCashierCommandHandler.ParseResponse(json);

        result.Actions[0].PaymentMethod.Should().Be("Card");
        result.State.Should().Be("complete");
    }

    [Fact]
    public void ParseResponse_MalformedJson_ReturnsFallbackResponse()
    {
        const string json = "this is definitely not json";

        AiCashierResponse result = AiCashierCommandHandler.ParseResponse(json);

        result.Message.Should().Be("عذراً، حدث خطأ. هل تودّ تكرار طلبك؟");
        result.State.Should().Be("taking_order");
        result.Actions.Should().BeEmpty();
    }

    [Fact]
    public void ParseResponse_JsonWrappedInCodeFence_ParsesSuccessfully()
    {
        const string fenced = """
            ```json
            {"message":"أهلاً بك!","actions":[],"state":"greeting"}
            ```
            """;

        AiCashierResponse result = AiCashierCommandHandler.ParseResponse(fenced);

        result.Message.Should().Be("أهلاً بك!");
        result.State.Should().Be("greeting");
    }

    // ── Handle (mocked Claude + empty InMemory catalog) ──────────────

    [Fact]
    public async Task Handle_EmptyMessages_CallsClaudeWithInitialUserMessage()
    {
        const string greetingJson = """{"message":"أهلاً!","actions":[],"state":"greeting"}""";
        var claudeMock = new Mock<IClaudeApiService>();
        claudeMock
            .Setup(c => c.ChatWithHistoryAsync(
                It.IsAny<string>(),
                It.IsAny<IReadOnlyList<ClaudeMessage>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(greetingJson);

        using var db = CreateCatalogDb();
        var handler = new AiCashierCommandHandler(claudeMock.Object, db);

        var result = await handler.Handle(new AiCashierCommand(Guid.NewGuid(), []), CancellationToken.None);

        result.IsError.Should().BeFalse();
        claudeMock.Verify(c =>
            c.ChatWithHistoryAsync(
                It.IsAny<string>(),
                It.Is<IReadOnlyList<ClaudeMessage>>(msgs =>
                    msgs.Count == 1
                    && msgs[0].Role == "user"
                    && msgs[0].Content == "ابدأ"),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_NonEmptyMessages_PassesThemDirectlyToClaudeAndReturnsParsedResponse()
    {
        const string responseJson = """{"message":"ايش ثاني؟","actions":[{"type":"add_item","variantId":"11111111-0000-0000-0000-000000000000","quantity":1,"notes":""}],"state":"taking_order"}""";
        var claudeMock = new Mock<IClaudeApiService>();
        claudeMock
            .Setup(c => c.ChatWithHistoryAsync(
                It.IsAny<string>(),
                It.IsAny<IReadOnlyList<ClaudeMessage>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(responseJson);

        IReadOnlyList<ClaudeMessage> history =
        [
            new ClaudeMessage("user", "ابدأ"),
            new ClaudeMessage("assistant", "أهلاً!"),
            new ClaudeMessage("user", "قهوة واحدة"),
        ];
        using var db = CreateCatalogDb();
        var handler = new AiCashierCommandHandler(claudeMock.Object, db);

        var result = await handler.Handle(new AiCashierCommand(Guid.NewGuid(), history), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.State.Should().Be("taking_order");
        result.Value.Actions.Should().HaveCount(1);
        result.Value.Actions[0].Type.Should().Be("add_item");

        claudeMock.Verify(c =>
            c.ChatWithHistoryAsync(
                It.IsAny<string>(),
                It.Is<IReadOnlyList<ClaudeMessage>>(msgs => msgs.Count == 3),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static CatalogDbContext CreateCatalogDb() =>
        new(new DbContextOptionsBuilder<CatalogDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options,
            new Mock<IPublisher>().Object);
}
