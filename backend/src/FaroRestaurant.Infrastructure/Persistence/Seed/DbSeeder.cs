using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using FaroRestaurant.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FaroRestaurant.Infrastructure.Persistence.Seed;

/// <summary>
/// Idempotent DEVELOPMENT seeder: safe to run on every startup, only inserts what is missing.
/// Test account passwords below are for local testing only and are documented in README.md.
/// </summary>
public class DbSeeder(
    AppDbContext db,
    RoleManager<ApplicationRole> roleManager,
    UserManager<ApplicationUser> userManager,
    IClock clock,
    ILogger<DbSeeder> logger)
{
    /// <summary>(email, username, full name, phone, role, dev password)</summary>
    private static readonly (string Email, string UserName, string Name, string Phone, string Role, string Password)[] TestAccounts =
    [
        ("admin@example.com", "admin", "Faro Admin", "+90 532 000 00 01", Roles.SuperAdmin, "Admin@12345"),
        ("manager@example.com", "manager", "Elif Yılmaz", "+90 532 000 00 02", Roles.Manager, "Manager@12345"),
        ("waiter@example.com", "waiter", "Mehmet Kaya", "+90 532 000 00 03", Roles.Waiter, "Waiter@12345"),
        ("waiter2@example.com", "waiter2", "Zeynep Arslan", "+90 532 000 00 06", Roles.Waiter, "Waiter@12345"),
        ("kitchen@example.com", "kitchen", "Ahmet Demir", "+90 532 000 00 04", Roles.Kitchen, "Kitchen@12345"),
        ("cashier@example.com", "cashier", "Ayşe Çelik", "+90 532 000 00 05", Roles.Cashier, "Cashier@12345"),
    ];

    private readonly Random _random = new(42); // deterministic demo data

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await IdentityRoles.EnsureCreatedAsync(roleManager, logger);
        var restaurant = await SeedRestaurantAsync(cancellationToken);
        await SeedUsersAsync(restaurant, cancellationToken);
        var tables = await SeedTablesAsync(restaurant, cancellationToken);
        var products = await SeedMenuAsync(restaurant, cancellationToken);
        var customers = await SeedCustomersAsync(restaurant, cancellationToken);
        await SeedOrdersAsync(restaurant, tables, products, customers, cancellationToken);
        await SeedReservationsAsync(restaurant, tables, customers, cancellationToken);
        await SeedInventoryAsync(restaurant, cancellationToken);
        await SeedNotificationsAsync(restaurant, cancellationToken);
        await SeedImagesAsync(restaurant, cancellationToken);
    }

    // Royalty-free photos (Unsplash License). Stored as URLs; the frontend requests a suitable size.
    private const string CoverImage = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=75";

    private static readonly Dictionary<string, string> ProductPhotos = new()
    {
        ["Espresso"] = "1510707577719-ae7c14805e3a",
        ["Americano"] = "1551030173-122aabc4489c",
        ["Cappuccino"] = "1572442388796-11668a67e53d",
        ["Caffè Latte"] = "1561882468-9110e03e0f78",
        ["Flat White"] = "1577968897966-3d4325b36b61",
        ["Turkish Coffee"] = "1506778020041-0ea35027d019",
        ["Turkish Breakfast Plate"] = "1533089860892-a7c6f0a88666",
        ["Menemen"] = "1525351484163-7529414344d8",
        ["Avocado Toast"] = "1588137378633-dea1336ce1e2",
        ["Classic Burger"] = "1568901346375-23c9450c58cd",
        ["Chicken Burger"] = "1606755962773-d324e0a13086",
        ["Truffle Burger"] = "1553979459-d2229ba7433b",
        ["Margherita"] = "1574071318508-1cdbab80d002",
        ["Pepperoni"] = "1628840042765-356cda07504e",
        ["Four Cheese"] = "1513104890138-7c749659a591",
        ["Caesar Salad"] = "1550304943-4f24f54ddde9",
        ["Penne Arrabbiata"] = "1621996346565-e3dbc646d9a9",
        ["Grilled Salmon"] = "1467003909585-2f8a72700288",
        ["Chicken Wrap"] = "1626700051175-6818013e1d4f",
        ["San Sebastian Cheesecake"] = "1635327173758-85badf17f995",
        ["Chocolate Brownie"] = "1606313564200-e75d5e30476c",
        ["Tiramisu"] = "1571877227200-a0d98ea607e9",
        ["Baklava"] = "1761828122856-8703baac8e86",
        ["Cola"] = "1629654613528-5d0a2e4166de",
        ["Fresh Lemonade"] = "1621263764928-df1444c5e859",
        ["Iced Latte"] = "1517701604599-bb29b565090c",
        ["Mineral Water"] = "1523362628745-0c100150b504",
        ["Turkish Tea"] = "1576092768241-dec231879fc3",
        ["Hot Chocolate"] = "1542990253-0d0f5be5f0ed",
        ["Herbal Tea"] = "1627435601361-ec25f5b1d0e5",
    };

    private static string PhotoUrl(string id) => $"https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=800&q=75";

    /// <summary>Adds photos to seeded products and a cover to the restaurant — only where none is set yet.</summary>
    private async Task SeedImagesAsync(Restaurant restaurant, CancellationToken ct)
    {
        var changed = 0;
        if (string.IsNullOrEmpty(restaurant.CoverImageUrl))
        {
            restaurant.CoverImageUrl = CoverImage;
            changed++;
        }

        var products = await db.Products.Where(p => p.RestaurantId == restaurant.Id && p.ImageUrl == null).ToListAsync(ct);
        foreach (var product in products)
        {
            if (!ProductPhotos.TryGetValue(product.Name, out var id)) continue;
            product.ImageUrl = PhotoUrl(id);
            changed++;
        }

        if (changed > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded {Count} image(s)", changed);
        }
    }

    private async Task<Restaurant> SeedRestaurantAsync(CancellationToken ct)
    {
        var existing = await db.Restaurants.OrderBy(r => r.CreatedAt).FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        var restaurant = new Restaurant
        {
            Name = Brand.Name,
            Slug = "faro-resturent-and-coffe",
            Phone = "+90 212 000 00 00",
            Email = "info@example.com",
            Address = "Istiklal Caddesi No: 1, Beyoğlu, Istanbul",
            Description = "Premium restaurant & specialty coffee.",
            OpeningTime = new TimeOnly(8, 0),
            ClosingTime = new TimeOnly(23, 0),
            Currency = Brand.DefaultCurrency,
            TaxRate = Brand.DefaultTaxRate,
        };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded restaurant {Name}", Brand.Name);
        return restaurant;
    }

    private async Task SeedUsersAsync(Restaurant restaurant, CancellationToken ct)
    {
        foreach (var account in TestAccounts)
        {
            if (await userManager.FindByEmailAsync(account.Email) is not null) continue;

            var user = new ApplicationUser
            {
                UserName = account.UserName,
                Email = account.Email,
                EmailConfirmed = true,
                FullName = account.Name,
                PhoneNumber = account.Phone,
                RestaurantId = restaurant.Id,
            };
            var result = await userManager.CreateAsync(user, account.Password);
            if (!result.Succeeded)
                throw new InvalidOperationException($"Failed to seed {account.Email}: {string.Join("; ", result.Errors.Select(e => e.Description))}");
            await userManager.AddToRoleAsync(user, account.Role);

            if (Roles.Staff.Contains(account.Role))
            {
                db.Staff.Add(new StaffMember
                {
                    RestaurantId = restaurant.Id,
                    UserId = user.Id,
                    FullName = account.Name,
                    Email = account.Email,
                    Phone = account.Phone,
                    Role = account.Role,
                    HiredOn = clock.Today.AddMonths(-_random.Next(2, 24)),
                });
            }
            logger.LogInformation("Seeded test account {Email} ({Role})", account.Email, account.Role);
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task<List<DiningTable>> SeedTablesAsync(Restaurant restaurant, CancellationToken ct)
    {
        if (!await db.Tables.AnyAsync(t => t.RestaurantId == restaurant.Id, ct))
        {
            (int Capacity, string Location)[] layout =
            [
                (2, "Window"), (2, "Window"), (4, "Main Hall"), (4, "Main Hall"), (4, "Main Hall"),
                (6, "Main Hall"), (4, "Terrace"), (4, "Terrace"), (2, "Garden"), (8, "VIP Room"),
            ];
            for (var i = 0; i < layout.Length; i++)
                db.Tables.Add(new DiningTable { RestaurantId = restaurant.Id, Number = i + 1, Capacity = layout[i].Capacity, Location = layout[i].Location });
            await db.SaveChangesAsync(ct);
        }
        return await db.Tables.Where(t => t.RestaurantId == restaurant.Id).OrderBy(t => t.Number).ToListAsync(ct);
    }

    private async Task<List<Product>> SeedMenuAsync(Restaurant restaurant, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.RestaurantId == restaurant.Id, ct))
        {
            var menu = new (string Name, string Icon, (string Name, string Desc, decimal Price, int Prep, bool Featured)[] Items)[]
            {
                ("Coffee", "☕",
                [
                    ("Espresso", "Double shot of our house blend", 80, 3, false),
                    ("Americano", "Espresso with hot water", 95, 3, false),
                    ("Cappuccino", "Espresso, steamed milk and milk foam", 120, 4, true),
                    ("Caffè Latte", "Espresso with silky steamed milk", 125, 4, false),
                    ("Flat White", "Ristretto with velvety micro-foam", 130, 4, false),
                    ("Turkish Coffee", "Traditional, served with lokum", 90, 6, true),
                ]),
                ("Breakfast", "🍳",
                [
                    ("Turkish Breakfast Plate", "Cheeses, olives, eggs, honey and simit", 420, 12, true),
                    ("Menemen", "Eggs with tomatoes, peppers and spices", 210, 10, false),
                    ("Avocado Toast", "Sourdough, avocado, poached egg", 240, 8, false),
                ]),
                ("Burger", "🍔",
                [
                    ("Classic Burger", "Beef patty, cheddar, pickles, house sauce", 290, 15, false),
                    ("Chicken Burger", "Crispy chicken, coleslaw, spicy mayo", 250, 14, true),
                    ("Truffle Burger", "Beef, truffle mayo, caramelised onion", 360, 16, false),
                ]),
                ("Pizza", "🍕",
                [
                    ("Margherita", "Tomato, mozzarella, fresh basil", 280, 14, false),
                    ("Pepperoni", "Tomato, mozzarella, spicy pepperoni", 320, 14, true),
                    ("Four Cheese", "Mozzarella, gorgonzola, parmesan, cheddar", 340, 14, false),
                ]),
                ("Food", "🍽️",
                [
                    ("Caesar Salad", "Romaine, parmesan, croutons, chicken", 230, 8, false),
                    ("Penne Arrabbiata", "Spicy tomato sauce, parsley", 240, 12, false),
                    ("Grilled Salmon", "With seasonal vegetables", 480, 18, true),
                    ("Chicken Wrap", "Grilled chicken, vegetables, yoghurt sauce", 220, 9, false),
                ]),
                ("Dessert", "🍰",
                [
                    ("San Sebastian Cheesecake", "Burnt Basque cheesecake", 190, 3, true),
                    ("Chocolate Brownie", "Warm, with vanilla ice cream", 170, 5, false),
                    ("Tiramisu", "Mascarpone, espresso, cocoa", 180, 3, false),
                    ("Baklava", "Pistachio baklava, 4 pieces", 200, 3, false),
                ]),
                ("Cold Drinks", "🥤",
                [
                    ("Cola", "330 ml", 60, 1, false),
                    ("Fresh Lemonade", "House-made with mint", 90, 3, true),
                    ("Iced Latte", "Espresso, cold milk, ice", 130, 3, false),
                    ("Mineral Water", "Sparkling, 200 ml", 40, 1, false),
                ]),
                ("Hot Drinks", "🍵",
                [
                    ("Turkish Tea", "Freshly brewed black tea", 35, 2, false),
                    ("Hot Chocolate", "Belgian chocolate, whipped cream", 120, 4, false),
                    ("Herbal Tea", "Chamomile, mint or linden", 70, 3, false),
                ]),
            };

            var sort = 0;
            var skuIndex = 100;
            foreach (var (name, icon, items) in menu)
            {
                var category = new Category { RestaurantId = restaurant.Id, Name = name, Icon = icon, SortOrder = sort++ };
                foreach (var item in items)
                {
                    category.Products.Add(new Product
                    {
                        RestaurantId = restaurant.Id,
                        Name = item.Name,
                        Description = item.Desc,
                        Price = item.Price,
                        PreparationMinutes = item.Prep,
                        IsFeatured = item.Featured,
                        Sku = $"{name[..3].ToUpperInvariant()}-{skuIndex++}",
                        // Desserts are made in limited batches — shows stock tracking.
                        Stock = name == "Dessert" ? 25 : null,
                    });
                }
                db.Categories.Add(category);
            }
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded menu: {Categories} categories, {Products} products", menu.Length, menu.Sum(m => m.Items.Length));
        }
        return await db.Products.Where(p => p.RestaurantId == restaurant.Id).ToListAsync(ct);
    }

    private async Task<List<Customer>> SeedCustomersAsync(Restaurant restaurant, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(c => c.RestaurantId == restaurant.Id, ct))
        {
            (string Name, string Phone, string Email)[] people =
            [
                ("Can Öztürk", "+90 533 111 11 11", "can.ozturk@example.com"),
                ("Deniz Aydın", "+90 533 222 22 22", "deniz.aydin@example.com"),
                ("Selin Koç", "+90 533 333 33 33", "selin.koc@example.com"),
                ("Emre Şahin", "+90 533 444 44 44", "emre.sahin@example.com"),
                ("Merve Doğan", "+90 533 555 55 55", "merve.dogan@example.com"),
            ];
            var days = 60;
            foreach (var (name, phone, email) in people)
            {
                db.Customers.Add(new Customer
                {
                    RestaurantId = restaurant.Id, Name = name, Phone = phone, Email = email,
                    CreatedAt = clock.UtcNow.AddDays(-days),
                });
                days -= 9;
            }
            await db.SaveChangesAsync(ct);
        }
        return await db.Customers.Where(c => c.RestaurantId == restaurant.Id).OrderBy(c => c.CreatedAt).ToListAsync(ct);
    }

    private async Task SeedOrdersAsync(Restaurant restaurant, List<DiningTable> tables, List<Product> products, List<Customer> customers, CancellationToken ct)
    {
        if (await db.Orders.AnyAsync(o => o.RestaurantId == restaurant.Id, ct)) return;

        // 20 orders: 14 finished orders over the past two weeks + 6 live orders today for the kitchen display.
        var plan = new List<(int DaysAgo, int Hour, OrderStatus Status)>();
        for (var i = 0; i < 14; i++) plan.Add((13 - i, 9 + _random.Next(0, 12), i == 5 ? OrderStatus.Cancelled : OrderStatus.Completed));
        plan.AddRange(
        [
            (0, 0, OrderStatus.Completed),
            (0, 0, OrderStatus.Served),
            (0, 0, OrderStatus.Ready),
            (0, 0, OrderStatus.Preparing),
            (0, 0, OrderStatus.Confirmed),
            (0, 0, OrderStatus.Pending),
        ]);

        var now = clock.UtcNow;
        var liveTable = 0;
        var minutesAgo = 95;
        var orders = new List<Order>();

        foreach (var (daysAgo, hour, status) in plan)
        {
            DateTime createdAt;
            if (daysAgo == 0)
            {
                createdAt = now.AddMinutes(-minutesAgo);
                minutesAgo -= 15;
            }
            else
            {
                createdAt = clock.StartOfDayUtc(clock.Today.AddDays(-daysAgo)).AddHours(hour).AddMinutes(_random.Next(0, 60));
            }

            DiningTable table;
            if (daysAgo == 0 && status is not OrderStatus.Completed)
                table = tables[liveTable++ % tables.Count]; // distinct table per live order
            else
                table = tables[_random.Next(tables.Count)];

            var customer = _random.Next(3) == 0 ? null : customers[_random.Next(customers.Count)];
            var order = new Order
            {
                RestaurantId = restaurant.Id,
                TableId = table.Id,
                CustomerId = customer?.Id,
                CustomerName = customer?.Name,
                Source = _random.Next(2) == 0 ? OrderSource.QrMenu : OrderSource.Staff,
                Status = status,
                TaxRate = restaurant.TaxRate,
                CreatedAt = createdAt,
            };

            var lines = _random.Next(1, 5);
            foreach (var product in products.OrderBy(_ => _random.Next()).Take(lines))
            {
                order.Items.Add(new OrderItem
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    UnitPrice = product.Price,
                    Quantity = _random.Next(1, 3),
                    CreatedAt = createdAt,
                });
            }
            if (_random.Next(6) == 0) order.Discount = 50;
            order.RecalculateTotals();

            if (status == OrderStatus.Completed)
            {
                order.PaymentStatus = PaymentStatus.Paid;
                order.CompletedAt = createdAt.AddMinutes(45);
                order.UpdatedAt = order.CompletedAt;
                var method = (PaymentMethod)_random.Next(0, 3);
                order.Payments.Add(new Payment
                {
                    RestaurantId = restaurant.Id,
                    Amount = order.Total,
                    Method = method,
                    Status = PaymentStatus.Paid,
                    Provider = "Simulated",
                    TransactionReference = $"SIM-SEED-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                    CreatedAt = createdAt.AddMinutes(40),
                    PaidAt = createdAt.AddMinutes(40),
                });
            }
            else if (status != OrderStatus.Cancelled)
            {
                table.Status = TableStatus.Occupied;
            }

            orders.Add(order);
        }

        // Insert in chronological order so order numbers follow time.
        foreach (var order in orders.OrderBy(o => o.CreatedAt))
        {
            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);
        }
        logger.LogInformation("Seeded {Count} orders", orders.Count);
    }

    private async Task SeedReservationsAsync(Restaurant restaurant, List<DiningTable> tables, List<Customer> customers, CancellationToken ct)
    {
        if (await db.Reservations.AnyAsync(r => r.RestaurantId == restaurant.Id, ct)) return;

        (int Day, int Hour, int Party, ReservationStatus Status, string? Note)[] plan =
        [
            (-3, 19, 4, ReservationStatus.Completed, null),
            (-2, 20, 2, ReservationStatus.Completed, "Anniversary dinner"),
            (-1, 13, 6, ReservationStatus.Cancelled, null),
            (0, 19, 2, ReservationStatus.Confirmed, "Window seat please"),
            (0, 20, 8, ReservationStatus.Confirmed, "Birthday — bring a candle"),
            (1, 12, 4, ReservationStatus.Pending, null),
            (2, 19, 2, ReservationStatus.Confirmed, null),
            (3, 20, 4, ReservationStatus.Pending, "Vegetarian guests"),
            (5, 13, 6, ReservationStatus.Pending, null),
            (7, 21, 2, ReservationStatus.Pending, null),
        ];

        for (var i = 0; i < plan.Length; i++)
        {
            var (day, hour, party, status, note) = plan[i];
            var customer = customers[i % customers.Count];
            var table = tables.Where(t => t.Capacity >= party).OrderBy(t => t.Capacity).Skip(i % 2).FirstOrDefault()
                        ?? tables.OrderByDescending(t => t.Capacity).First();
            db.Reservations.Add(new Reservation
            {
                RestaurantId = restaurant.Id,
                CustomerId = customer.Id,
                CustomerName = customer.Name,
                Phone = customer.Phone!,
                Email = customer.Email,
                Date = clock.Today.AddDays(day),
                Time = new TimeOnly(hour, i % 2 == 0 ? 0 : 30),
                PartySize = party,
                TableId = table.Id,
                Status = status,
                Notes = note,
                CreatedAt = clock.UtcNow.AddDays(Math.Min(day, 0) - 2),
            });
        }
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} reservations", plan.Length);
    }

    private async Task SeedInventoryAsync(Restaurant restaurant, CancellationToken ct)
    {
        if (await db.InventoryItems.AnyAsync(i => i.RestaurantId == restaurant.Id, ct)) return;

        (string Name, string Unit, decimal Qty, decimal Min, string Supplier, decimal Cost)[] items =
        [
            ("Coffee Beans", "kg", 2, 5, "Kuru Kahveci Roasters", 850),
            ("Whole Milk", "L", 18, 10, "Sütaş", 32),
            ("Oat Milk", "L", 4, 6, "Oatly Distributor", 95),
            ("Burger Buns", "pcs", 60, 30, "Uno Bakery", 6),
            ("Beef Patties", "pcs", 45, 20, "Metro Gross", 48),
            ("Chicken Breast", "kg", 9, 5, "Banvit", 210),
            ("Mozzarella", "kg", 6, 4, "Pınar", 320),
            ("Pizza Dough", "pcs", 25, 15, "In-house", 12),
            ("Tomatoes", "kg", 14, 8, "Local Market", 35),
            ("Chocolate", "kg", 1.5m, 2, "Callebaut", 690),
            ("Sugar", "kg", 20, 5, "Metro Gross", 38),
            ("Paper Cups", "pcs", 400, 200, "Packaging Co.", 2.5m),
        ];

        foreach (var (name, unit, qty, min, supplier, cost) in items)
        {
            var item = new InventoryItem
            {
                RestaurantId = restaurant.Id, Name = name, Unit = unit, Quantity = qty, MinimumQuantity = min,
                Supplier = supplier, PurchasePrice = cost,
            };
            item.Transactions.Add(new InventoryTransaction
            {
                Type = InventoryTransactionType.StockIn, QuantityChange = qty, QuantityAfter = qty, Note = "Opening stock",
            });
            db.InventoryItems.Add(item);
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedNotificationsAsync(Restaurant restaurant, CancellationToken ct)
    {
        if (await db.Notifications.AnyAsync(n => n.RestaurantId == restaurant.Id, ct)) return;

        var lowStock = await db.InventoryItems.Where(i => i.RestaurantId == restaurant.Id && i.Quantity <= i.MinimumQuantity).ToListAsync(ct);
        var minutes = 5;
        foreach (var item in lowStock)
        {
            db.Notifications.Add(new Notification
            {
                RestaurantId = restaurant.Id,
                Type = NotificationType.LowStock,
                Title = $"Low stock · {item.Name}",
                Message = $"Remaining: {item.Quantity:0.##} {item.Unit} · Minimum: {item.MinimumQuantity:0.##} {item.Unit}",
                Link = "/inventory",
                CreatedAt = clock.UtcNow.AddMinutes(-(minutes += 20)),
            });
        }
        db.Notifications.Add(new Notification
        {
            RestaurantId = restaurant.Id,
            Type = NotificationType.System,
            Title = "Welcome to FARO RESTURENT AND COFFE",
            Message = "Your portal is ready. Test data has been loaded for this development environment.",
            Link = "/dashboard",
            IsRead = true,
            CreatedAt = clock.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync(ct);
    }
}
