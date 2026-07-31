using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.SignRentalContract;

public sealed record SignRentalContractCommand(Guid ContractId, Guid BranchId) : ICommand<RentalContractResponse>;
