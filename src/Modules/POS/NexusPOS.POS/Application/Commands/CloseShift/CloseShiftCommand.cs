using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CloseShift;

public sealed record CloseShiftCommand(
    Guid ShiftId,
    Guid BranchId,
    Guid UserId,
    decimal ClosingCash,
    decimal ClosingCardCount,
    string? Notes) : ICommand<ShiftResponse>;
