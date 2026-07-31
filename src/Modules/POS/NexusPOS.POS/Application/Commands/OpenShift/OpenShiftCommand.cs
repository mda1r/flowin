using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.OpenShift;

public sealed record OpenShiftCommand(
    Guid BranchId,
    Guid UserId,
    string CashierName,
    decimal OpeningCash) : ICommand<ShiftResponse>;
