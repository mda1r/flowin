using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CloseShift;

/// <summary>
/// Closes a shift. A cashier may only close their own; with <paramref name="ClosedByManager"/> an owner or
/// manager closes another user's shift and <paramref name="ClosedByName"/> records who did it.
/// </summary>
public sealed record CloseShiftCommand(
    Guid ShiftId,
    Guid BranchId,
    Guid UserId,
    decimal ClosingCash,
    decimal ClosingCardCount,
    string? Notes,
    bool ClosedByManager = false,
    string? ClosedByName = null) : ICommand<ShiftResponse>;
