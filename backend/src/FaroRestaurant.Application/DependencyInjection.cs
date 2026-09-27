using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Common.Services;
using FaroRestaurant.Application.Customers;
using FaroRestaurant.Application.Inventory;
using FaroRestaurant.Application.Menu;
using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Application.Payments;
using FaroRestaurant.Application.Reports;
using FaroRestaurant.Application.Reservations;
using FaroRestaurant.Application.Restaurants;
using FaroRestaurant.Application.Staff;
using FaroRestaurant.Application.Tables;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace FaroRestaurant.Application;

public static class DependencyInjection
{
    /// <summary>Registers application-layer business services and validators.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<IRestaurantScope, RestaurantScope>();
        services.AddScoped<IRestaurantService, RestaurantService>();
        services.AddScoped<ITableService, TableService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IPublicMenuService, PublicMenuService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IReservationService, ReservationService>();
        services.AddScoped<IStaffService, StaffService>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IReportService, ReportService>();

        return services;
    }
}
