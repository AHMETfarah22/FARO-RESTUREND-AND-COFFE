namespace FaroRestaurant.Api.Middleware;

/// <summary>
/// Adds defensive HTTP response headers to every API response.
/// </summary>
public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";

        // The interactive API docs need scripts/styles; everything else is pure JSON.
        if (!context.Request.Path.StartsWithSegments("/scalar") &&
            !context.Request.Path.StartsWithSegments("/openapi"))
        {
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
        }

        return next(context);
    }
}
