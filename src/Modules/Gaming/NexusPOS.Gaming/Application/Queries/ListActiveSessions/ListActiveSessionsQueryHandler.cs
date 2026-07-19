using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.ListActiveSessions;

internal sealed class ListActiveSessionsQueryHandler(IGameSessionRepository gameSessionRepository)
    : IQueryHandler<ListActiveSessionsQuery, IReadOnlyList<GameSessionResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<GameSessionResponse>>> Handle(
        ListActiveSessionsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<GameSession> sessions = await gameSessionRepository.FindActiveByBranchAsync(
            request.BranchId, cancellationToken);

        return sessions.Select(GamingMapper.ToSessionResponse).ToList();
    }
}
