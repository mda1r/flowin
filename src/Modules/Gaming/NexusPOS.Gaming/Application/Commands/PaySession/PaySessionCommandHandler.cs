using ErrorOr;
using MediatR;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Gaming.Application.Commands.PaySession;

internal sealed class PaySessionCommandHandler(
    IGameSessionRepository sessions,
    IGameStationRepository stations,
    GamingDbContext db,
    IPublisher publisher)
    : ICommandHandler<PaySessionCommand, GameSessionBillResponse>
{
    // Session prices include VAT, like the cafe menu they are sold alongside.
    private const decimal VatRate = 0.15m;

    public async Task<ErrorOr<GameSessionBillResponse>> Handle(PaySessionCommand request, CancellationToken cancellationToken)
    {
        GameSession? session = await sessions.FindByIdAsync(request.SessionId, cancellationToken);
        if (session is null || session.BranchId != request.BranchId)
        {
            return GamingErrors.SessionNotFound;
        }

        if (session.Status != GameSessionStatus.Completed)
        {
            return GamingErrors.SessionNotCompleted;
        }

        if (session.PaidAt.HasValue)
        {
            return GamingErrors.SessionAlreadyPaid;
        }

        GameStation? station = await stations.FindByIdAsync(new GameStationId(session.StationId), cancellationToken);
        int minutes = (int)Math.Round(((session.EndTime ?? DateTime.UtcNow) - session.StartTime).TotalMinutes);

        // Record the sale first; only then mark the session paid, so a failure here can simply be retried.
        if (session.TotalAmount > 0)
        {
            await publisher.Publish(new ExternalSaleCompletedDomainEvent(
                session.TenantId,
                session.BranchId,
                ExternalSaleCompletedDomainEvent.Gaming,
                session.Id,
                [new ExternalSaleCompletedDomainEvent.Line(
                    session.Id,
                    $"جلسة لعب - {station?.Name ?? "محطة"} ({minutes} د)",
                    Math.Round(session.TotalAmount / (1 + VatRate), 4),
                    1m)],
                0m,
                VatRate,
                request.PaymentMethod,
                session.TotalAmount), cancellationToken);
        }

        ErrorOr<Success> paid = session.MarkPaid(request.PaymentMethod);
        if (paid.IsError)
        {
            return paid.Errors;
        }

        sessions.Update(session);
        await db.SaveChangesAsync(cancellationToken);

        return station is null ? GamingErrors.StationNotFound : GamingMapper.ToBillResponse(session, station);
    }
}
