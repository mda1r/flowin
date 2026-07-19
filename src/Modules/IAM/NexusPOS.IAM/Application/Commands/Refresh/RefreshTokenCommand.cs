using NexusPOS.IAM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.Refresh;

public sealed record RefreshTokenCommand(string Token) : ICommand<TokenResponse>;
