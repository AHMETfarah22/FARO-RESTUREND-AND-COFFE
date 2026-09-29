using FaroRestaurant.Api.Extensions;
using FaroRestaurant.Api.Middleware;
using FaroRestaurant.Api.Realtime;
using FaroRestaurant.Application;
using FaroRestaurant.Infrastructure;
using FaroRestaurant.Infrastructure.Persistence;
using Scalar.AspNetCore;

// Load backend/.env into environment variables (searching parent folders).
// Real environment variables always win, so production never depends on a .env file.
DotNetEnv.Env.NoClobber().TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddApiServices(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<SecurityHeadersMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options => options.WithTitle("FARO RESTURENT AND COFFE API"));
}
// Off for an installation on the restaurant's own network, which is reached over plain http://<computer>:5080.
else if (app.Configuration.GetValue("App:HttpsRedirection", true))
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Installed package: the built portal (frontend/dist) is in wwwroot and served on the same address as the API.
var servesPortal = File.Exists(Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html"));
if (servesPortal)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseCors(ApiServiceExtensions.CorsPolicy);
app.UseMiddleware<LicenseMiddleware>();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<RestaurantHub>(RestaurantHub.Path);

if (servesPortal)
{
    // Portal routes (/dashboard, /menu/table/…) load the single-page app; unknown API paths stay 404.
    app.MapFallback("/api/{**path}", () => Results.NotFound());
    app.MapFallbackToFile("{*path:nonfile}", "index.html");
}

if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
    await app.Services.InitializeDatabaseAsync(seed: app.Configuration.GetValue("Database:SeedOnStartup", false));

app.Run();
