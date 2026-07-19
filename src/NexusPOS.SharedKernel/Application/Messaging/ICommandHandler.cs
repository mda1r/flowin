using ErrorOr;
using MediatR;

namespace NexusPOS.SharedKernel.Application.Messaging;

public interface ICommandHandler<TCommand> : IRequestHandler<TCommand, ErrorOr<Success>>
    where TCommand : ICommand;

public interface ICommandHandler<TCommand, TResponse> : IRequestHandler<TCommand, ErrorOr<TResponse>>
    where TCommand : ICommand<TResponse>;
