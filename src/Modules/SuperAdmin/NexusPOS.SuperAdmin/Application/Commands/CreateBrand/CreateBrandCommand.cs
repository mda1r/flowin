using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateBrand;

public sealed record CreateBrandCommand(
    string NameAr,
    string NameEn,
    string Code,
    string? Notes,
    Guid ActorId) : ICommand<BrandResponse>;
