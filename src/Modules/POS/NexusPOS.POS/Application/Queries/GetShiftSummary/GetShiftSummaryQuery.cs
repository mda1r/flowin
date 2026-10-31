using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.GetShiftSummary;

/// <summary>One shift with its figures so far; a cashier may only read their own.</summary>
public sealed record GetShiftSummaryQuery(Guid BranchId, Guid ShiftId, Guid UserId, bool CanSeeAllShifts) : IQuery<ShiftResponse>;
