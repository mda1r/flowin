using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Queries.GetVatReturnData;

public sealed record GetVatReturnDataQuery(Guid PeriodId, Guid TenantId) : IQuery<VatReturnResponse>;
