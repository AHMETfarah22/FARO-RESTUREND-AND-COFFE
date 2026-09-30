using System.Globalization;
using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Reports;

public interface IReportService
{
    Task<ReportDto> GetReportAsync(DateOnly? from, DateOnly? to, ReportGrouping groupBy, CancellationToken cancellationToken = default);
    Task<DashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default);
    Task<ExportedFile> ExportAsync(ReportSection section, ExportFormat format, DateOnly? from, DateOnly? to, ReportGrouping groupBy, CancellationToken cancellationToken = default);
}

/// <summary>
/// Revenue = total of paid, non-cancelled orders. Days are bucketed in the restaurant's local time zone.
/// </summary>
public class ReportService(IAppDbContext db, IRestaurantScope scope, IClock clock, IReportExporter exporter) : IReportService
{
    private const int MaxRangeDays = 366 * 3;

    private sealed record OrderRow(Guid Id, DateTime CreatedAt, OrderStatus Status, PaymentStatus PaymentStatus, decimal Total, decimal TaxAmount, decimal Discount);

    private sealed record ItemRow(Guid OrderId, string ProductName, string? CategoryName, int Quantity, decimal LineTotal);

    public async Task<ReportDto> GetReportAsync(DateOnly? from, DateOnly? to, ReportGrouping groupBy, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var end = to ?? clock.Today;
        var start = from ?? end.AddDays(-29);
        if (start > end) throw new Common.Exceptions.ValidationException(new Dictionary<string, string[]> { ["from"] = ["Start date must be before end date."] });
        if (end.DayNumber - start.DayNumber > MaxRangeDays) throw new ConflictException("Please choose a date range of at most 3 years.");

        var currency = await db.Restaurants.Where(r => r.Id == restaurantId).Select(r => r.Currency).FirstAsync(cancellationToken);
        var orders = await LoadOrdersAsync(restaurantId, start, end, cancellationToken);
        var sold = orders.Where(IsSale).ToList();
        var items = await LoadItemsAsync(sold.Select(o => o.Id).ToList(), cancellationToken);

        var reservations = await db.Reservations.AsNoTracking()
            .Where(r => r.RestaurantId == restaurantId && r.Date >= start && r.Date <= end)
            .Select(r => new { r.Status, r.PartySize })
            .ToListAsync(cancellationToken);

        var payments = await db.Payments.AsNoTracking()
            .Where(p => p.RestaurantId == restaurantId && p.Status == PaymentStatus.Paid &&
                        p.CreatedAt >= clock.StartOfDayUtc(start) && p.CreatedAt < clock.StartOfDayUtc(end.AddDays(1)))
            .GroupBy(p => p.Method)
            .Select(g => new PaymentMethodDto(g.Key, g.Count(), g.Sum(p => p.Amount)))
            .ToListAsync(cancellationToken);

        var inventory = await InventoryRowsAsync(restaurantId, lowOnly: false, cancellationToken);
        var revenue = sold.Sum(o => o.Total);

        var totals = new ReportTotalsDto(
            revenue,
            sold.Count,
            orders.Count(o => o.Status == OrderStatus.Cancelled),
            sold.Count == 0 ? 0 : Math.Round(revenue / sold.Count, 2),
            sold.Sum(o => o.TaxAmount),
            sold.Sum(o => o.Discount),
            items.Sum(i => i.Quantity),
            reservations.Count(r => r.Status != ReservationStatus.Cancelled),
            reservations.Where(r => r.Status != ReservationStatus.Cancelled).Sum(r => r.PartySize));

        return new ReportDto(
            start, end, groupBy, currency, totals,
            BuildSeries(sold, start, end, groupBy),
            ProductSales(items, 20),
            CategorySales(items),
            Enum.GetValues<PaymentMethod>()
                .Select(m => payments.FirstOrDefault(p => p.Method == m) ?? new PaymentMethodDto(m, 0, 0)).ToList(),
            Enum.GetValues<OrderStatus>().Select(s => new StatusCountDto(s.ToString(), orders.Count(o => o.Status == s))).ToList(),
            Enum.GetValues<ReservationStatus>().Select(s => new StatusCountDto(s.ToString(), reservations.Count(r => r.Status == s))).ToList(),
            inventory);
    }

    public async Task<DashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var today = clock.Today;
        var currency = await db.Restaurants.Where(r => r.Id == restaurantId).Select(r => r.Currency).FirstAsync(cancellationToken);

        var orders = await LoadOrdersAsync(restaurantId, today.AddDays(-29), today, cancellationToken);
        var todayStart = clock.StartOfDayUtc(today);
        var yesterdayStart = clock.StartOfDayUtc(today.AddDays(-1));

        var todayOrders = orders.Where(o => o.CreatedAt >= todayStart).ToList();
        // Same time yesterday: comparing a day in progress with a whole day would always look like a drop.
        var sameTimeYesterday = clock.UtcNow.AddDays(-1);
        var yesterdayOrders = orders.Where(o => o.CreatedAt >= yesterdayStart && o.CreatedAt < todayStart && o.CreatedAt <= sameTimeYesterday).ToList();
        var todaySales = todayOrders.Where(IsSale).Sum(o => o.Total);
        var yesterdaySales = yesterdayOrders.Where(IsSale).Sum(o => o.Total);
        var todayCount = todayOrders.Count(o => o.Status != OrderStatus.Cancelled);
        var yesterdayCount = yesterdayOrders.Count(o => o.Status != OrderStatus.Cancelled);

        var sold30 = orders.Where(IsSale).ToList();
        var items30 = await LoadItemsAsync(sold30.Select(o => o.Id).ToList(), cancellationToken);

        var pendingStatuses = new[] { OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready };
        var pending = await db.Orders.CountAsync(o => o.RestaurantId == restaurantId && pendingStatuses.Contains(o.Status), cancellationToken);
        var completedToday = todayOrders.Count(o => o.Status == OrderStatus.Completed);

        var tables = await db.Tables.AsNoTracking().Where(t => t.RestaurantId == restaurantId)
            .GroupBy(t => t.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToListAsync(cancellationToken);

        var reservationsToday = await db.Reservations.CountAsync(r =>
            r.RestaurantId == restaurantId && r.Date == today && r.Status != ReservationStatus.Cancelled, cancellationToken);

        var lowStock = await InventoryRowsAsync(restaurantId, lowOnly: true, cancellationToken);

        var recent = await db.Orders.AsNoTracking()
            .Include(o => o.Items).Include(o => o.Payments).Include(o => o.Table).Include(o => o.Customer).AsSplitQuery()
            .Where(o => o.RestaurantId == restaurantId)
            .OrderByDescending(o => o.CreatedAt).Take(6)
            .ToListAsync(cancellationToken);

        return new DashboardDto(
            currency,
            new KpiDto(todaySales, Change(todaySales, yesterdaySales)),
            new KpiDto(todayCount, Change(todayCount, yesterdayCount)),
            pending,
            completedToday,
            reservationsToday,
            tables.Where(t => t.Status == TableStatus.Available).Sum(t => t.Count),
            tables.Where(t => t.Status == TableStatus.Occupied).Sum(t => t.Count),
            tables.Sum(t => t.Count),
            lowStock.Count,
            BuildSeries(sold30, today.AddDays(-6), today, ReportGrouping.Day),
            ProductSales(items30, 5),
            CategorySales(items30),
            lowStock.Take(5).ToList(),
            recent.Select(OrderService.ToDto).ToList());
    }

    public async Task<ExportedFile> ExportAsync(ReportSection section, ExportFormat format, DateOnly? from, DateOnly? to, ReportGrouping groupBy, CancellationToken cancellationToken = default)
    {
        var report = await GetReportAsync(from, to, groupBy, cancellationToken);
        var c = CultureInfo.InvariantCulture;
        string M(decimal v) => v.ToString("0.00", c);

        var (title, headers, rows) = section switch
        {
            ReportSection.Sales => ($"{report.GroupBy} Sales", new[] { "Period", "Orders", $"Revenue ({report.Currency})" },
                report.Sales.Select(s => new[] { s.Label, s.Orders.ToString(c), M(s.Revenue) }).ToList()),
            ReportSection.Products => ("Product Sales", new[] { "Product", "Category", "Quantity", $"Revenue ({report.Currency})" },
                report.Products.Select(p => new[] { p.ProductName, p.CategoryName, p.Quantity.ToString(c), M(p.Revenue) }).ToList()),
            ReportSection.Categories => ("Category Sales", new[] { "Category", "Quantity", $"Revenue ({report.Currency})" },
                report.Categories.Select(p => new[] { p.CategoryName, p.Quantity.ToString(c), M(p.Revenue) }).ToList()),
            ReportSection.Payments => ("Payments", new[] { "Method", "Count", $"Amount ({report.Currency})" },
                report.Payments.Select(p => new[] { p.Method.ToString(), p.Count.ToString(c), M(p.Amount) }).ToList()),
            ReportSection.Orders => ("Orders by Status", new[] { "Status", "Orders" },
                report.OrderStatuses.Select(s => new[] { s.Status, s.Count.ToString(c) }).ToList()),
            ReportSection.Reservations => ("Reservations by Status", new[] { "Status", "Reservations" },
                report.ReservationStatuses.Select(s => new[] { s.Status, s.Count.ToString(c) }).ToList()),
            _ => ("Inventory", new[] { "Item", "Unit", "Quantity", "Minimum", $"Stock value ({report.Currency})", "Low stock" },
                report.Inventory.Select(i => new[] { i.Name, i.Unit, i.Quantity.ToString("0.##", c), i.MinimumQuantity.ToString("0.##", c), M(i.StockValue), i.IsLowStock ? "Yes" : "No" }).ToList()),
        };

        var subtitle = $"{report.From:dd.MM.yyyy} – {report.To:dd.MM.yyyy} · Revenue {M(report.Totals.Revenue)} {report.Currency} · {report.Totals.Orders} orders";
        return exporter.Export(new TabularReport(title, subtitle, headers, rows.Select(r => (IReadOnlyList<string>)r).ToList()), format);
    }

    // ---------------------------------------------------------------- helpers

    private static bool IsSale(OrderRow o) => o.Status != OrderStatus.Cancelled && o.PaymentStatus == PaymentStatus.Paid;

    private static decimal? Change(decimal current, decimal previous) =>
        previous == 0 ? null : Math.Round((current - previous) / previous * 100m, 1);

    private async Task<List<OrderRow>> LoadOrdersAsync(Guid restaurantId, DateOnly start, DateOnly end, CancellationToken cancellationToken) =>
        await db.Orders.AsNoTracking()
            .Where(o => o.RestaurantId == restaurantId && o.CreatedAt >= clock.StartOfDayUtc(start) && o.CreatedAt < clock.StartOfDayUtc(end.AddDays(1)))
            .Select(o => new OrderRow(o.Id, o.CreatedAt, o.Status, o.PaymentStatus, o.Total, o.TaxAmount, o.Discount))
            .ToListAsync(cancellationToken);

    private async Task<List<ItemRow>> LoadItemsAsync(List<Guid> orderIds, CancellationToken cancellationToken)
    {
        if (orderIds.Count == 0) return [];
        return await db.OrderItems.AsNoTracking()
            .Where(i => orderIds.Contains(i.OrderId))
            .Select(i => new ItemRow(i.OrderId, i.ProductName, i.Product == null ? null : i.Product.Category!.Name, i.Quantity, i.UnitPrice * i.Quantity))
            .ToListAsync(cancellationToken);
    }

    private async Task<List<InventoryReportRowDto>> InventoryRowsAsync(Guid restaurantId, bool lowOnly, CancellationToken cancellationToken)
    {
        var query = db.InventoryItems.AsNoTracking().Where(i => i.RestaurantId == restaurantId);
        if (lowOnly) query = query.Where(i => i.Quantity <= i.MinimumQuantity);
        return await query
            .OrderBy(i => i.MinimumQuantity == 0 ? 1 : i.Quantity / i.MinimumQuantity).ThenBy(i => i.Name)
            .Select(i => new InventoryReportRowDto(i.Name, i.Unit, i.Quantity, i.MinimumQuantity, i.Quantity * i.PurchasePrice, i.Quantity <= i.MinimumQuantity))
            .ToListAsync(cancellationToken);
    }

    private static List<ProductSalesDto> ProductSales(List<ItemRow> items, int take) =>
        items.GroupBy(i => i.ProductName)
            .Select(g => new ProductSalesDto(g.Key, g.First().CategoryName ?? "—", g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal)))
            .OrderByDescending(p => p.Quantity).ThenByDescending(p => p.Revenue)
            .Take(take).ToList();

    private static List<CategorySalesDto> CategorySales(List<ItemRow> items) =>
        items.GroupBy(i => i.CategoryName ?? "Other")
            .Select(g => new CategorySalesDto(g.Key, g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal)))
            .OrderByDescending(c => c.Revenue).ToList();

    private List<SalesPointDto> BuildSeries(List<OrderRow> sold, DateOnly start, DateOnly end, ReportGrouping groupBy)
    {
        var buckets = new List<(DateOnly Start, DateOnly EndExclusive, string Label)>();
        var cursor = PeriodStart(start, groupBy);
        while (cursor <= end)
        {
            var next = groupBy switch
            {
                ReportGrouping.Day => cursor.AddDays(1),
                ReportGrouping.Week => cursor.AddDays(7),
                ReportGrouping.Month => cursor.AddMonths(1),
                _ => cursor.AddYears(1),
            };
            var label = groupBy switch
            {
                ReportGrouping.Day => cursor.ToString("dd MMM", CultureInfo.InvariantCulture),
                ReportGrouping.Week => "Week of " + cursor.ToString("dd MMM", CultureInfo.InvariantCulture),
                ReportGrouping.Month => cursor.ToString("MMM yyyy", CultureInfo.InvariantCulture),
                _ => cursor.Year.ToString(CultureInfo.InvariantCulture),
            };
            buckets.Add((cursor, next, label));
            cursor = next;
        }

        var byDay = sold.GroupBy(o => DateOnly.FromDateTime(clock.ToLocal(o.CreatedAt)))
            .ToDictionary(g => g.Key, g => (Revenue: g.Sum(o => o.Total), Count: g.Count()));

        return buckets.Select(b =>
        {
            var days = byDay.Where(d => d.Key >= b.Start && d.Key < b.EndExclusive).Select(d => d.Value).ToList();
            return new SalesPointDto(b.Label, b.Start, days.Sum(d => d.Revenue), days.Sum(d => d.Count));
        }).ToList();
    }

    private static DateOnly PeriodStart(DateOnly date, ReportGrouping groupBy) => groupBy switch
    {
        ReportGrouping.Week => date.AddDays(-(((int)date.DayOfWeek + 6) % 7)), // Monday
        ReportGrouping.Month => new DateOnly(date.Year, date.Month, 1),
        ReportGrouping.Year => new DateOnly(date.Year, 1, 1),
        _ => date,
    };
}
