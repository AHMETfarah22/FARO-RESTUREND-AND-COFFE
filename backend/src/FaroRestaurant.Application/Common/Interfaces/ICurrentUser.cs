namespace FaroRestaurant.Application.Common.Interfaces;

/// <summary>The authenticated caller, resolved from the JWT.</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid? UserId { get; }
    string? Email { get; }
    Guid? RestaurantId { get; }
    IReadOnlyCollection<string> Roles { get; }
    bool IsInRole(string role);
}

/// <summary>Resolves which restaurant the current request operates on.</summary>
public interface IRestaurantScope
{
    Task<Guid> GetRestaurantIdAsync(CancellationToken cancellationToken = default);
}
