using FaroRestaurant.Application.Restaurants;
using FaroRestaurant.Application.Tables;
using FaroRestaurant.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FaroRestaurant.Api.Controllers;

[ApiController]
[Route("api/restaurants")]
[Authorize]
public class RestaurantsController(IRestaurantService restaurants) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = Roles.SuperAdmin)]
    public Task<IReadOnlyList<RestaurantDto>> List(CancellationToken ct) => restaurants.ListAsync(ct);

    /// <summary>Public branding (name, logo, cover photo) for the login page.</summary>
    [HttpGet("public")]
    [AllowAnonymous]
    public Task<PublicRestaurantDto> Public(CancellationToken ct) => restaurants.GetPublicAsync(ct);

    /// <summary>The restaurant the signed-in user works for.</summary>
    [HttpGet("current")]
    public Task<RestaurantDto> Current(CancellationToken ct) => restaurants.GetCurrentAsync(ct);

    [HttpPost]
    [Authorize(Roles = Roles.SuperAdmin)]
    public Task<RestaurantDto> Create(SaveRestaurantRequest request, CancellationToken ct) => restaurants.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = RoleGroups.RestaurantSettings)]
    public Task<RestaurantDto> Update(Guid id, SaveRestaurantRequest request, CancellationToken ct) => restaurants.UpdateAsync(id, request, ct);

    [HttpPut("current/settings")]
    [Authorize(Roles = RoleGroups.RestaurantSettings)]
    public Task<RestaurantDto> UpdateSettings(RestaurantSettingsDto request, CancellationToken ct) => restaurants.UpdateSettingsAsync(request, ct);

    /// <summary>Deactivates the restaurant (history is preserved).</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await restaurants.DeactivateAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/tables")]
[Authorize(Roles = RoleGroups.AllStaff)]
public class TablesController(ITableService tables) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<TableDto>> List(CancellationToken ct) => tables.ListAsync(ct);

    [HttpGet("{id:guid}")]
    public Task<TableDto> Get(Guid id, CancellationToken ct) => tables.GetAsync(id, ct);

    [HttpPost]
    [Authorize(Roles = RoleGroups.TableManagement)]
    public Task<TableDto> Create(SaveTableRequest request, CancellationToken ct) => tables.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = RoleGroups.TableManagement)]
    public Task<TableDto> Update(Guid id, SaveTableRequest request, CancellationToken ct) => tables.UpdateAsync(id, request, ct);

    /// <summary>Quick status change (e.g. waiter marks a table as cleaned).</summary>
    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = RoleGroups.TableView)]
    public Task<TableDto> UpdateStatus(Guid id, UpdateTableStatusRequest request, CancellationToken ct) => tables.UpdateStatusAsync(id, request.Status, ct);

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = RoleGroups.TableManagement)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await tables.DeleteAsync(id, ct);
        return NoContent();
    }
}
