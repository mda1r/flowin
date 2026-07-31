using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.GetCurrentShift;

public sealed record GetCurrentShiftQuery(Guid BranchId, Guid UserId) : IQuery<ShiftResponse?>;
