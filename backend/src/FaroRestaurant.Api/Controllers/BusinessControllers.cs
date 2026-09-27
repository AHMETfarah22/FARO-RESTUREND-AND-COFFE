using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Common.Models;
using FaroRestaurant.Application.Customers;
using FaroRestaurant.Application.Inventory;
using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Application.Reports;
using FaroRestaurant.Application.Reservations;
using FaroRestaurant.Application.Staff;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FaroRestaurant.Api.Controllers;

[ApiController]
[Route("api/reservations")]
[Authorize(Roles = RoleGroups.Reservations)]
public class ReservationsController(IReservationService reservations) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<ReservationDto>> List(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] ReservationStatus? status, [FromQuery] string? search, CancellationToken ct) =>
        reservations.ListAsync(from, to, status, search, ct);

    [HttpGet("{id:guid}")]
    public Task<ReservationDto> Get(Guid id, CancellationToken ct) => reservations.GetAsync(id, ct);

    [HttpPost]
    public Task<ReservationDto> Create(SaveReservationRequest request, CancellationToken ct) => reservations.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    public Task<ReservationDto> Update(Guid id, SaveReservationRequest request, CancellationToken ct) => reservations.UpdateAsync(id, request, ct);

    [HttpPut("{id:guid}/status")]
    public Task<ReservationDto> UpdateStatus(Guid id, UpdateReservationStatusRequest request, CancellationToken ct) =>
        reservations.UpdateStatusAsync(id, request.Status, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await reservations.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/customers")]
[Authorize(Roles = RoleGroups.Customers)]
public class CustomersController(ICustomerService customers) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<CustomerDto>> List([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        customers.ListAsync(search, page, pageSize, ct);

    [HttpGet("{id:guid}")]
    public Task<CustomerDetailDto> Get(Guid id, CancellationToken ct) => customers.GetAsync(id, ct);

    [HttpPost]
    public Task<CustomerDto> Create(SaveCustomerRequest request, CancellationToken ct) => customers.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    public Task<CustomerDto> Update(Guid id, SaveCustomerRequest request, CancellationToken ct) => customers.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = RoleGroups.Management)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await customers.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>For signed-in customer accounts: their own order history.</summary>
[ApiController]
[Route("api/customers/me")]
[Authorize(Roles = Roles.Customer)]
public class MyAccountController(ICustomerService customers) : ControllerBase
{
    [HttpGet("orders")]
    public Task<IReadOnlyList<OrderDto>> MyOrders(CancellationToken ct) => customers.GetMyOrdersAsync(ct);
}

[ApiController]
[Route("api/staff")]
[Authorize(Roles = RoleGroups.Staff)]
public class StaffController(IStaffService staff) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<StaffDto>> List(CancellationToken ct) => staff.ListAsync(ct);

    [HttpPost]
    public Task<StaffDto> Create(CreateStaffRequest request, CancellationToken ct) => staff.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    public Task<StaffDto> Update(Guid id, UpdateStaffRequest request, CancellationToken ct) => staff.UpdateAsync(id, request, ct);

    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, ResetStaffPasswordRequest request, CancellationToken ct)
    {
        await staff.ResetPasswordAsync(id, request.NewPassword, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await staff.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/inventory")]
[Authorize(Roles = RoleGroups.Inventory)]
public class InventoryController(IInventoryService inventory) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<InventoryItemDto>> List([FromQuery] string? search, [FromQuery] bool lowStock = false, CancellationToken ct = default) =>
        inventory.ListAsync(search, lowStock, ct);

    [HttpPost]
    public Task<InventoryItemDto> Create(SaveInventoryItemRequest request, CancellationToken ct) => inventory.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    public Task<InventoryItemDto> Update(Guid id, SaveInventoryItemRequest request, CancellationToken ct) => inventory.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await inventory.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/movements")]
    public Task<InventoryItemDto> Move(Guid id, StockMovementRequest request, CancellationToken ct) => inventory.MoveStockAsync(id, request, ct);

    [HttpGet("{id:guid}/transactions")]
    public Task<IReadOnlyList<InventoryTransactionDto>> Transactions(Guid id, CancellationToken ct) => inventory.GetTransactionsAsync(id, ct);
}

[ApiController]
[Route("api/reports")]
[Authorize(Roles = RoleGroups.Reports)]
public class ReportsController(IReportService reports) : ControllerBase
{
    /// <summary>Everything the reports page needs for a date range.</summary>
    [HttpGet]
    public Task<ReportDto> Get([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] ReportGrouping groupBy = ReportGrouping.Day, CancellationToken ct = default) =>
        reports.GetReportAsync(from, to, groupBy, ct);

    [HttpGet("sales")]
    public async Task<IReadOnlyList<SalesPointDto>> Sales([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] ReportGrouping groupBy = ReportGrouping.Day, CancellationToken ct = default) =>
        (await reports.GetReportAsync(from, to, groupBy, ct)).Sales;

    [HttpGet("orders")]
    public async Task<IReadOnlyList<StatusCountDto>> Orders([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct = default) =>
        (await reports.GetReportAsync(from, to, ReportGrouping.Day, ct)).OrderStatuses;

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] ReportSection section, [FromQuery] ExportFormat format,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] ReportGrouping groupBy = ReportGrouping.Day, CancellationToken ct = default)
    {
        var file = await reports.ExportAsync(section, format, from, to, groupBy, ct);
        return File(file.Content, file.ContentType, file.FileName);
    }
}

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = RoleGroups.Dashboard)]
public class DashboardController(IReportService reports) : ControllerBase
{
    [HttpGet]
    public Task<DashboardDto> Get(CancellationToken ct) => reports.GetDashboardAsync(ct);
}

[ApiController]
[Route("api/notifications")]
[Authorize(Roles = RoleGroups.AllStaff)]
public class NotificationsController(INotificationService notifications) : ControllerBase
{
    [HttpGet]
    public Task<NotificationListDto> List([FromQuery] bool unreadOnly = false, [FromQuery] int take = 50, CancellationToken ct = default) =>
        notifications.ListAsync(unreadOnly, take, ct);

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await notifications.MarkReadAsync(id, ct);
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        await notifications.MarkAllReadAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await notifications.DeleteAsync(id, ct);
        return NoContent();
    }
}
