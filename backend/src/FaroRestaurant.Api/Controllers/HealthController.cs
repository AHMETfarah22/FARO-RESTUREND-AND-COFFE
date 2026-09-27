using FaroRestaurant.Application.Health;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FaroRestaurant.Api.Controllers;

[ApiController]
[Route("api/health")]
[AllowAnonymous]
public class HealthController(ISystemHealthService healthService) : ControllerBase
{
    /// <summary>Reports API and database status.</summary>
    [HttpGet]
    [ProducesResponseType<SystemHealthDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SystemHealthDto>> Get(CancellationToken cancellationToken) =>
        Ok(await healthService.GetHealthAsync(cancellationToken));
}
