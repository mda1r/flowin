using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.ActivateRentalContract;

public sealed record ActivateRentalContractCommand(Guid ContractId, Guid BranchId) : ICommand<RentalContractResponse>;
