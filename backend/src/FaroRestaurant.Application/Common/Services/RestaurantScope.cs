using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Common.Services;

/// <summary>
/// Staff users carry a restaurant_id claim. Super admins (no restaurant) and anonymous callers fall back
/// to the first active restaurant — enough for the single-restaurant test build, and the only place to
/// change when adding a restaurant switcher.
/// </summary>
public class RestaurantScope(ICurrentUser currentUser, IAppDbContext db) : IRestaurantScope
{
    private Guid? _cached;

    public async Task<Guid> GetRestaurantIdAsync(CancellationToken cancellationToken = default)
    {
        if (_cached is { } id) return id;

        _cached = currentUser.RestaurantId
            ?? await db.Restaurants.AsNoTracking()
                .Where(r => r.IsActive)
                .OrderBy(r => r.CreatedAt)
                .Select(r => (Guid?)r.Id)
                .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Restaurant", "default");

        return _cached.Value;
    }
}
