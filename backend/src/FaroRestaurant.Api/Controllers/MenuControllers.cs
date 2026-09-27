using FaroRestaurant.Api.Extensions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Menu;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FaroRestaurant.Api.Controllers;

[ApiController]
[Route("api/categories")]
[Authorize(Roles = RoleGroups.AllStaff)]
public class CategoriesController(ICategoryService categories) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<CategoryDto>> List(CancellationToken ct) => categories.ListAsync(ct);

    [HttpPost]
    [Authorize(Roles = RoleGroups.MenuManagement)]
    public Task<CategoryDto> Create(SaveCategoryRequest request, CancellationToken ct) => categories.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = RoleGroups.MenuManagement)]
    public Task<CategoryDto> Update(Guid id, SaveCategoryRequest request, CancellationToken ct) => categories.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = RoleGroups.MenuManagement)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await categories.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/products")]
[Authorize(Roles = RoleGroups.AllStaff)]
public class ProductsController(IProductService products) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<ProductDto>> List([FromQuery] string? search, [FromQuery] Guid? categoryId, [FromQuery] bool? available, CancellationToken ct) =>
        products.ListAsync(new ProductQuery(search, categoryId, available), ct);

    [HttpGet("{id:guid}")]
    public Task<ProductDto> Get(Guid id, CancellationToken ct) => products.GetAsync(id, ct);

    [HttpPost]
    [Authorize(Roles = RoleGroups.MenuManagement)]
    public Task<ProductDto> Create(SaveProductRequest request, CancellationToken ct) => products.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = RoleGroups.MenuManagement)]
    public Task<ProductDto> Update(Guid id, SaveProductRequest request, CancellationToken ct) => products.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = RoleGroups.MenuManagement)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await products.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Public QR menu — no login required.</summary>
[ApiController]
[Route("api/menu")]
[AllowAnonymous]
public class PublicMenuController(IPublicMenuService menu, IOrderService orders, ICustomerPushNotifier push) : ControllerBase
{
    /// <summary>VAPID public key for "order ready" phone notifications (empty when push is not configured).</summary>
    [HttpGet("push/public-key")]
    public object PushPublicKey() => new { publicKey = push.PublicKey };

    /// <summary>Subscribes this phone to push notifications for an order it placed.</summary>
    [HttpPost("orders/{orderId:guid}/push-subscription")]
    [EnableRateLimiting(ApiServiceExtensions.PublicOrderRateLimitPolicy)]
    public async Task<IActionResult> SubscribeToPush(Guid orderId, PushSubscriptionRequest request, CancellationToken ct)
    {
        await orders.SubscribeToPushAsync(orderId, request, ct);
        return NoContent();
    }

    [HttpGet("tables/{tableId:guid}")]
    public Task<PublicMenuDto> GetMenu(Guid tableId, CancellationToken ct) => menu.GetForTableAsync(tableId, ct);

    [HttpPost("tables/{tableId:guid}/orders")]
    [EnableRateLimiting(ApiServiceExtensions.PublicOrderRateLimitPolicy)]
    public async Task<PublicOrderStatusDto> PlaceOrder(Guid tableId, PublicOrderRequest request, CancellationToken ct)
    {
        var order = await orders.CreatePublicAsync(tableId, request, ct);
        return await orders.GetPublicStatusAsync(order.Id, ct);
    }

    [HttpGet("orders/{orderId:guid}")]
    public Task<PublicOrderStatusDto> OrderStatus(Guid orderId, CancellationToken ct) => orders.GetPublicStatusAsync(orderId, ct);
}
