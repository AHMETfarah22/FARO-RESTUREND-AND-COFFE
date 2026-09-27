using FaroRestaurant.Api.Extensions;
using FaroRestaurant.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FaroRestaurant.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(ApiServiceExtensions.AuthRateLimitPolicy)]
    public Task<AuthResponse> Login(LoginRequest request, CancellationToken ct) => auth.LoginAsync(request, ct);

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(ApiServiceExtensions.AuthRateLimitPolicy)]
    public Task<AuthResponse> Register(RegisterRequest request, CancellationToken ct) => auth.RegisterAsync(request, ct);

    [HttpGet("me")]
    [Authorize]
    public Task<UserDto> Me(CancellationToken ct) => auth.GetCurrentUserAsync(ct);

    [HttpPut("profile")]
    [Authorize]
    public Task<UserDto> UpdateProfile(UpdateProfileRequest request, CancellationToken ct) => auth.UpdateProfileAsync(request, ct);

    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting(ApiServiceExtensions.AuthRateLimitPolicy)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await auth.ChangePasswordAsync(request, ct);
        return NoContent();
    }
}
