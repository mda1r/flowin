using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListOpenShifts;

/// <summary>Every shift still open in the branch, whoever opened it, with its figures so far.</summary>
public sealed record ListOpenShiftsQuery(Guid BranchId) : IQuery<IReadOnlyList<ShiftResponse>>;
