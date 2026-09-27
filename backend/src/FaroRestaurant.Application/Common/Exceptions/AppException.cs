namespace FaroRestaurant.Application.Common.Exceptions;

/// <summary>
/// Base class for expected business errors. The API maps these to proper HTTP status codes
/// instead of a generic 500.
/// </summary>
public abstract class AppException(string message) : Exception(message)
{
    public abstract int StatusCode { get; }
}

public sealed class NotFoundException(string entity, object key)
    : AppException($"{entity} '{key}' was not found.")
{
    public override int StatusCode => 404;
}

public sealed class ConflictException(string message) : AppException(message)
{
    public override int StatusCode => 409;
}

public sealed class UnauthorizedException(string message) : AppException(message)
{
    public override int StatusCode => 401;
}

public sealed class ForbiddenException(string message = "You do not have permission to perform this action.")
    : AppException(message)
{
    public override int StatusCode => 403;
}

public sealed class ValidationException(IDictionary<string, string[]> errors)
    : AppException("One or more validation errors occurred.")
{
    public IDictionary<string, string[]> Errors { get; } = errors;
    public override int StatusCode => 400;
}
