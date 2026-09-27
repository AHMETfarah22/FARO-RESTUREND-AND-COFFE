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
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors(ApiServiceExtensions.CorsPolicy);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<RestaurantHub>(RestaurantHub.Path);

if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
    await app.Services.InitializeDatabaseAsync(seed: app.Configuration.GetValue("Database:SeedOnStartup", false));

app.Run();
