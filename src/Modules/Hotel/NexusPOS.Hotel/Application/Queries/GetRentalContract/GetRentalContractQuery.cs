using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.GetRentalContract;

public sealed record GetRentalContractQuery(Guid ContractId, Guid BranchId) : IQuery<RentalContractResponse>;
