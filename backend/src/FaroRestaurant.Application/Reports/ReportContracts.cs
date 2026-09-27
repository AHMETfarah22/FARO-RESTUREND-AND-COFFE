using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Application.Reports;

public enum ReportGrouping { Day, Week, Month, Year }

public enum ReportSection { Sales, Products, Categories, Payments, Orders, Reservations, Inventory }

public sealed record SalesPointDto(string Label, DateOnly PeriodStart, decimal Revenue, int Orders);

public sealed record ProductSalesDto(string ProductName, string CategoryName, int Quantity, decimal Revenue);

public sealed record CategorySalesDto(string CategoryName, int Quantity, decimal Revenue);

public sealed record PaymentMethodDto(PaymentMethod Method, int Count, decimal Amount);

public sealed record StatusCountDto(string Status, int Count);

public sealed record InventoryReportRowDto(string Name, string Unit, decimal Quantity, decimal MinimumQuantity, decimal StockValue, bool IsLowStock);

public sealed record ReportTotalsDto(
    decimal Revenue,
    int Orders,
    int CancelledOrders,
    decimal AverageOrderValue,
    decimal Tax,
    decimal Discounts,
    int ItemsSold,
    int Reservations,
    int Guests);

public sealed record ReportDto(
    DateOnly From,
    DateOnly To,
    ReportGrouping GroupBy,
    string Currency,
    ReportTotalsDto Totals,
    IReadOnlyList<SalesPointDto> Sales,
    IReadOnlyList<ProductSalesDto> Products,
    IReadOnlyList<CategorySalesDto> Categories,
    IReadOnlyList<PaymentMethodDto> Payments,
    IReadOnlyList<StatusCountDto> OrderStatuses,
    IReadOnlyList<StatusCountDto> ReservationStatuses,
    IReadOnlyList<InventoryReportRowDto> Inventory);

public sealed record KpiDto(decimal Value, decimal? ChangePercent);

public sealed record DashboardDto(
    string Currency,
    KpiDto TodaySales,
    KpiDto TodayOrders,
    int PendingOrders,
    int CompletedOrders,
    int TodayReservations,
    int AvailableTables,
    int OccupiedTables,
    int TotalTables,
    int LowStockCount,
    IReadOnlyList<SalesPointDto> Last7Days,
    IReadOnlyList<ProductSalesDto> PopularProducts,
    IReadOnlyList<CategorySalesDto> CategorySales,
    IReadOnlyList<InventoryReportRowDto> LowStockItems,
    IReadOnlyList<Orders.OrderDto> RecentOrders);
