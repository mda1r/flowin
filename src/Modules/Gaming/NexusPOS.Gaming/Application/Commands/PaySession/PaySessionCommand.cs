using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.PaySession;

public sealed record PaySessionCommand(Guid BranchId, Guid SessionId, string PaymentMethod) : ICommand<GameSessionBillResponse>;
