using FaroRestaurant.Api.Extensions;
using FaroRestaurant.Application.Auth;
using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Licensing;
using FaroRestaurant.Application.Setup;
using FaroRestaurant.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FaroRestaurant.Api.Controllers;

/// <summary>Activation of this installation (open while it is locked — see LicenseMiddleware).</summary>
[ApiController]
[Route("api/license")]
[AllowAnonymous]
public class LicenseController(ILicenseService licenses, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public LicenseStatusDto Get() => licenses.GetStatus();

    [HttpPost]
    [EnableRateLimiting(ApiServiceExtensions.AuthRateLimitPolicy)]
    public LicenseStatusDto Activate(ActivateLicenseRequest request)
    {
        // A locked installation can be activated by anyone at the counter (nobody can sign in yet);
        // replacing the license of a working installation takes an administrator.
        if (licenses.IsActive && !currentUser.IsInRole(Roles.SuperAdmin) && !currentUser.IsInRole(Roles.RestaurantAdmin))
            throw new ForbiddenException("Only an administrator can change the license.");
        return licenses.Activate(request.Key);
    }
}

/// <summary>First run of a new installation: restaurant name and the first administrator.</summary>
[ApiController]
[Route("api/setup")]
[AllowAnonymous]
public class SetupController(ISetupService setup) : ControllerBase
{
    [HttpGet]
    public Task<SetupStatusDto> Status(CancellationToken ct) => setup.GetStatusAsync(ct);

    [HttpPost]
    [EnableRateLimiting(ApiServiceExtensions.AuthRateLimitPolicy)]
    public Task<AuthResponse> Complete(CompleteSetupRequest request, CancellationToken ct) => setup.CompleteAsync(request, ct);
}
