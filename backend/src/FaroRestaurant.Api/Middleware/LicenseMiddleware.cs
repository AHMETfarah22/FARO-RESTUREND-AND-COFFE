using FaroRestaurant.Application.Licensing;
using Microsoft.AspNetCore.Mvc;

namespace FaroRestaurant.Api.Middleware;

/// <summary>
/// Locks the API and the real-time hub until this computer has an active license. Answers
/// 402 "license_required", which makes the portal show its activation screen.
/// </summary>
public class LicenseMiddleware(RequestDelegate next, ILicenseService licenses)
{
    public const string ProblemCode = "license_required";

    public Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        var locked = (path.StartsWithSegments("/api") || path.StartsWithSegments("/hubs")) &&
                     !path.StartsWithSegments("/api/license") &&
                     !path.StartsWithSegments("/api/health") &&
                     !licenses.IsActive;
        if (!locked) return next(context);

        context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
        return context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status402PaymentRequired,
            Title = "This installation is not activated.",
            Extensions = { ["code"] = ProblemCode, ["license"] = licenses.GetStatus().Status.ToString() },
        }, options: null, contentType: "application/problem+json");
    }
}
