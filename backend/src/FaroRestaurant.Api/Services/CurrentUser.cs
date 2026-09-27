using System.Security.Claims;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Infrastructure.Identity;
using Microsoft.IdentityModel.JsonWebTokens;

namespace FaroRestaurant.Api.Services;

public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid? UserId => Guid.TryParse(Find(JwtRegisteredClaimNames.Sub) ?? Find(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public string? Email => Find(JwtRegisteredClaimNames.Email) ?? Find(ClaimTypes.Email);

    public Guid? RestaurantId => Guid.TryParse(Find(AppClaims.RestaurantId), out var id) ? id : null;

    public IReadOnlyCollection<string> Roles =>
        Principal?.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList() ?? [];

    public bool IsInRole(string role) => Principal?.IsInRole(role) == true;

    private string? Find(string type) => Principal?.FindFirst(type)?.Value;
}
