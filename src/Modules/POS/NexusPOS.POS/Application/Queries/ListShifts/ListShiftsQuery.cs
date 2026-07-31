using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListShifts;

public sealed record ListShiftsQuery(Guid BranchId, int Page = 1, int PageSize = 20) : IQuery<IReadOnlyList<ShiftResponse>>;
