using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Queries.GetBrandDetail;

public sealed record GetBrandDetailQuery(Guid BrandId) : IQuery<BrandDetailResponse>;
