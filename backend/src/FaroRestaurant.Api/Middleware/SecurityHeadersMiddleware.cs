namespace FaroRestaurant.Api.Middleware;

/// <summary>
/// Adds defensive HTTP response headers to every response.
/// </summary>
public class SecurityHeadersMiddleware(RequestDelegate next)
{
    /// <summary>
    /// The portal itself (installed package, served from wwwroot): own scripts only, Google Fonts,
    /// menu photos from any https host, and API / SignalR calls to this same address.
    /// </summary>
    private const string PortalPolicy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self'; " +
        "worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";

        // The interactive API docs need scripts/styles; the API itself is pure JSON.
        var path = context.Request.Path;
        if (!path.StartsWithSegments("/scalar") && !path.StartsWithSegments("/openapi"))
        {
            headers["Content-Security-Policy"] = path.StartsWithSegments("/api") || path.StartsWithSegments("/hubs")
                ? "default-src 'none'; frame-ancestors 'none'"
                : PortalPolicy;
        }

        return next(context);
    }
}
