using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListRentalContracts;

public sealed record ListRentalContractsQuery(Guid BranchId, int Page = 1, int PageSize = 20)
    : IQuery<IReadOnlyList<RentalContractResponse>>;
