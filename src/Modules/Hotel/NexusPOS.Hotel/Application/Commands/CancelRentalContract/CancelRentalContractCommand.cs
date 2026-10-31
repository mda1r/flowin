using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CancelRentalContract;

public sealed record CancelRentalContractCommand(Guid ContractId, Guid BranchId) : ICommand<RentalContractResponse>;
