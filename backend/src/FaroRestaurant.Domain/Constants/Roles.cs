using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Domain.Constants;

/// <summary>
/// Canonical role names used for role-based authorization across the system.
/// </summary>
public static class Roles
{
    public const string SuperAdmin = "SuperAdmin";
    public const string RestaurantAdmin = "RestaurantAdmin";
    public const string Manager = "Manager";
    public const string Waiter = "Waiter";
    public const string Kitchen = "Kitchen";
    public const string Cashier = "Cashier";
    public const string Customer = "Customer";

    public static readonly IReadOnlyList<string> All =
    [
        SuperAdmin, RestaurantAdmin, Manager, Waiter, Kitchen, Cashier, Customer
    ];

    /// <summary>Roles that belong to restaurant employees (assignable from Staff Management).</summary>
    public static readonly IReadOnlyList<string> Staff = [Manager, Waiter, Kitchen, Cashier];
}

/// <summary>
/// Comma-separated role lists for [Authorize(Roles = ...)] — one place defines who may do what.
/// Mirrored in the frontend (src/lib/permissions.ts) to hide navigation the user cannot use.
/// </summary>
public static class RoleGroups
{
    private const string Admins = Roles.SuperAdmin + "," + Roles.RestaurantAdmin;

    public const string Management = Admins + "," + Roles.Manager;
    public const string AllStaff = Management + "," + Roles.Waiter + "," + Roles.Kitchen + "," + Roles.Cashier;

    /// <summary>Business dashboard (sales, stock, charts). Floor staff have their own workspaces instead.</summary>
    public const string Dashboard = Management;

    public const string RestaurantSettings = Admins;
    public const string MenuManagement = Management;
    public const string TableManagement = Management;
    public const string TableView = Management + "," + Roles.Waiter + "," + Roles.Cashier;
    public const string OrderView = AllStaff;
    public const string OrderCreate = Management + "," + Roles.Waiter;
    public const string OrderStatus = AllStaff;
    public const string Kitchen = Management + "," + Roles.Kitchen;
    public const string Reservations = Management + "," + Roles.Waiter;
    public const string Customers = Management + "," + Roles.Waiter + "," + Roles.Cashier;
    public const string Staff = Management;
    public const string Inventory = Management;
    public const string Payments = Management + "," + Roles.Cashier;
    public const string Reports = Management;
}

/// <summary>
/// Separation of duties for the order workflow: which roles may move an order into each status.
/// Management may do every step. Mirrored in the frontend (canMoveOrderTo in src/lib/permissions.ts).
/// </summary>
public static class OrderDuties
{
    private static readonly Dictionary<OrderStatus, string[]> MoveTo = new()
    {
        [OrderStatus.Confirmed] = [Roles.Waiter, Roles.Kitchen], // accept a QR order
        [OrderStatus.Preparing] = [Roles.Kitchen],
        [OrderStatus.Ready] = [Roles.Kitchen],
        [OrderStatus.Served] = [Roles.Waiter],
        [OrderStatus.Completed] = [Roles.Cashier],
        [OrderStatus.Cancelled] = [Roles.Waiter],
    };

    private static readonly string[] Management = [Roles.SuperAdmin, Roles.RestaurantAdmin, Roles.Manager];

    public static bool CanMoveTo(OrderStatus status, Func<string, bool> isInRole) =>
        Management.Any(isInRole) || (MoveTo.TryGetValue(status, out var roles) && roles.Any(isInRole));
}
