namespace FaroRestaurant.Application.Common.Interfaces;

public sealed record CreateUserCommand(
    string FullName, string Email, string UserName, string? Phone, string Password, string Role, Guid? RestaurantId);

public sealed record UpdateUserCommand(Guid UserId, string FullName, string Email, string UserName, string? Phone, string Role, bool IsActive);

/// <summary>User account operations (ASP.NET Core Identity lives in Infrastructure).</summary>
public interface IIdentityService
{
    Task<Guid> CreateUserAsync(CreateUserCommand command, CancellationToken cancellationToken = default);
    Task UpdateUserAsync(UpdateUserCommand command, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(Guid userId, string newPassword, CancellationToken cancellationToken = default);
    Task DeleteUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<string?> GetUserNameAsync(Guid userId, CancellationToken cancellationToken = default);
}
