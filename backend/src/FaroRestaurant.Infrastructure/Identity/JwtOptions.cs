namespace FaroRestaurant.Infrastructure.Identity;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "FaroRestaurant.Api";
    public string Audience { get; set; } = "FaroRestaurant.Client";
    public int ExpiresMinutes { get; set; } = 120;
}

public static class AppClaims
{
    public const string RestaurantId = "restaurant_id";
    public const string FullName = "name";
    public const string SecurityStamp = "sstamp";
}
