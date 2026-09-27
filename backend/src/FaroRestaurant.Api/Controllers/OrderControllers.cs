using FaroRestaurant.Application.Common.Models;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Application.Payments;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FaroRestaurant.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize(Roles = RoleGroups.OrderView)]
public class OrdersController(IOrderService orders) : ControllerBase
{
    /// <param name="status">One or more statuses, e.g. ?status=Pending&amp;status=Confirmed</param>
    [HttpGet]
    public Task<PagedResult<OrderDto>> List(
        [FromQuery] OrderStatus[]? status,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string? search,
        [FromQuery] Guid? tableId,
        [FromQuery] PaymentStatus? paymentStatus,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        orders.ListAsync(new OrderQuery(status, from, to, search, tableId, paymentStatus, page, pageSize), ct);

    [HttpGet("{id:guid}")]
    public Task<OrderDto> Get(Guid id, CancellationToken ct) => orders.GetAsync(id, ct);

    [HttpPost]
    [Authorize(Roles = RoleGroups.OrderCreate)]
    public Task<OrderDto> Create(CreateOrderRequest request, CancellationToken ct) => orders.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = RoleGroups.OrderCreate)]
    public Task<OrderDto> Update(Guid id, UpdateOrderRequest request, CancellationToken ct) => orders.UpdateAsync(id, request, ct);

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = RoleGroups.OrderStatus)]
    public Task<OrderDto> UpdateStatus(Guid id, UpdateOrderStatusRequest request, CancellationToken ct) => orders.UpdateStatusAsync(id, request.Status, ct);
}

[ApiController]
[Route("api/kitchen")]
[Authorize(Roles = RoleGroups.Kitchen)]
public class KitchenController(IOrderService orders) : ControllerBase
{
    [HttpGet("orders")]
    public Task<IReadOnlyList<OrderDto>> Board(CancellationToken ct) => orders.GetKitchenBoardAsync(ct);
}

[ApiController]
[Route("api/payments")]
[Authorize(Roles = RoleGroups.Payments)]
public class PaymentsController(IPaymentService payments) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<PaymentDto>> List(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] PaymentStatus? status, [FromQuery] PaymentMethod? method,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        payments.ListAsync(new PaymentQuery(from, to, status, method, page, pageSize), ct);

    [HttpGet("summary")]
    public Task<PaymentSummaryDto> Summary([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct) =>
        payments.SummaryAsync(from, to, ct);

    [HttpPost]
    public Task<PaymentResultDto> Pay(CreatePaymentRequest request, CancellationToken ct) => payments.PayAsync(request, ct);

    [HttpPost("{id:guid}/refund")]
    [Authorize(Roles = RoleGroups.Management)]
    public Task<PaymentResultDto> Refund(Guid id, CancellationToken ct) => payments.RefundAsync(id, ct);
}
