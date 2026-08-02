using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.Finance.Infrastructure.Persistence;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Infrastructure.Persistence;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.Sales.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.Zatca.Infrastructure.Persistence;
using Npgsql;
using SuperAdminPlan = NexusPOS.SuperAdmin.Domain.Entities.SubscriptionPlan;

namespace NexusPOS.Api.Infrastructure;

internal static class DatabaseInitializerExtensions
{
    private const string AdminEmail = "admin@nexuspos.com";
    private const string AdminPassword = "Admin@123!";
    private const string SuperAdminEmail = "superadmin@nexuspos.com";
    private const string SuperAdminPassword = "SuperAdmin@123!";

    private static readonly Guid _demoTenantId = new("10000000-0000-0000-0000-000000000001");
    private static readonly Guid _demoBranchId = new("20000000-0000-0000-0000-000000000001");

    private const string DemoAdminPassword = "Admin@123!";

    internal static async Task InitializeDatabasesAsync(this WebApplication app)
    {
        using IServiceScope scope = app.Services.CreateScope();
        IServiceProvider sp = scope.ServiceProvider;
        ILogger logger = sp.GetRequiredService<ILogger<WebApplication>>();

        try
        {
            await EnsureCreatedAsync<IamDbContext>(sp, logger);
            await EnsureCreatedAsync<OrganizationDbContext>(sp, logger);
            await EnsureCreatedAsync<CatalogDbContext>(sp, logger);
            await EnsureCreatedAsync<InventoryDbContext>(sp, logger);
            await EnsureCreatedAsync<PosDbContext>(sp, logger);
            await EnsureCreatedAsync<SalesDbContext>(sp, logger);
            await EnsureCreatedAsync<PurchasingDbContext>(sp, logger);
            await EnsureCreatedAsync<CrmDbContext>(sp, logger);
            await EnsureCreatedAsync<FinanceDbContext>(sp, logger);
            await EnsureCreatedAsync<RestaurantDbContext>(sp, logger);
            await EnsureCreatedAsync<HotelDbContext>(sp, logger);
            await EnsureCreatedAsync<GamingDbContext>(sp, logger);
            await EnsureCreatedAsync<SuperAdminDbContext>(sp, logger);
            await EnsureCreatedAsync<ZatcaDbContext>(sp, logger);

            await ApplySchemaPatches(sp, logger);
            await SeedAdminUserAsync(sp, logger);
            await SeedSuperAdminUserAsync(sp, logger);
            await SeedDefaultPlansAsync(sp, logger);
            await SeedDemoDataAsync(sp, logger);
            await SeedMultiTypeDemoTenantsAsync(sp, logger);
            await SeedHotelDemoDataAsync(sp, logger);
            await SeedGamingDemoDataAsync(sp, logger);
            await SeedExpiryDemoDataAsync(sp, logger);
            await ProvisionTenantSchemasAsync(app.Services, logger);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database initialization failed");
            throw;
        }
    }

    // Splits a PostgreSQL DDL script by ';' while skipping semicolons inside
    // dollar-quoted blocks (e.g. DO $EF$...CREATE SCHEMA...;...END $EF$).
    private static IEnumerable<string> SplitSqlStatements(string script)
    {
        bool inDollarQuote = false;
        string dollarTag = string.Empty;
        int start = 0;

        for (int i = 0; i < script.Length; i++)
        {
            if (script[i] == '$')
            {
                int end = script.IndexOf('$', i + 1);
                if (end > i)
                {
                    string candidate = script[i..(end + 1)];
                    if (!inDollarQuote)
                    {
                        inDollarQuote = true;
                        dollarTag = candidate;
                        i = end;
                        continue;
                    }
                    if (candidate == dollarTag)
                    {
                        inDollarQuote = false;
                        dollarTag = string.Empty;
                        i = end;
                        continue;
                    }
                }
            }

            if (!inDollarQuote && script[i] == ';')
            {
                string stmt = script[start..i].Trim();
                if (!string.IsNullOrWhiteSpace(stmt))
                {
                    yield return stmt;
                }

                start = i + 1;
            }
        }

        string last = script[start..].Trim();
        if (!string.IsNullOrWhiteSpace(last))
        {
            yield return last;
        }
    }

    private static async Task EnsureCreatedAsync<TContext>(IServiceProvider sp, ILogger logger)
        where TContext : DbContext
    {
        TContext db = sp.GetRequiredService<TContext>();

        // EnsureCreated returns false when ANY tables exist in the DB (even from other contexts).
        // Work around by generating the DDL and executing each statement individually,
        // ignoring PostgreSQL "already exists" errors per statement.
        await db.Database.EnsureCreatedAsync(); // creates DB if it doesn't exist

        string script = db.Database.GenerateCreateScript();
        IEnumerable<string> statements = SplitSqlStatements(script);

        int created = 0;
        foreach (string stmt in statements)
        {
            if (string.IsNullOrWhiteSpace(stmt)) { continue; }
            try
            {
                await db.Database.ExecuteSqlRawAsync(stmt);
                created++;
            }
            catch (PostgresException ex) when (
                ex.SqlState is "42P07"  // duplicate_table
                             or "42P06" // duplicate_schema
                             or "42710" // duplicate_object (index/constraint)
                             or "42701" // duplicate_column
            )
            {
                // Schema/table/index/constraint already exists — safe to skip
            }
        }

        if (created > 0)
        {
            logger.LogInformation("Created {Count} schema objects for {Context}", created, typeof(TContext).Name);
        }
        else
        {
            logger.LogDebug("Schema already up to date for {Context}", typeof(TContext).Name);
        }
    }

    private static async Task ApplySchemaPatches(IServiceProvider sp, ILogger logger)
    {
        // Idempotent ALTER TABLE patches for columns added to existing tables.
        // Each uses IF NOT EXISTS so it's safe to re-run on every startup.
        HotelDbContext hotelDb = sp.GetRequiredService<HotelDbContext>();
        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();
        InventoryDbContext inventoryDb = sp.GetRequiredService<InventoryDbContext>();
        IamDbContext iamDb2 = sp.GetRequiredService<IamDbContext>();
        OrganizationDbContext orgDb2 = sp.GetRequiredService<OrganizationDbContext>();
        SuperAdminDbContext superAdminDb2 = sp.GetRequiredService<SuperAdminDbContext>();

        (DbContext ctx, string sql)[] patches =
        [
            (hotelDb,       "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_status VARCHAR(16) NOT NULL DEFAULT 'Clean'"),
            (catalogDb,     "ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITHOUT TIME ZONE"),
            (inventoryDb,   "ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITHOUT TIME ZONE"),
            (orgDb2,        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type INTEGER NOT NULL DEFAULT 0"),
            (orgDb2,        $"UPDATE tenants SET business_type = 1 WHERE id = '10000000-0000-0000-0000-000000000001' AND business_type = 0"),
            (iamDb2,        "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID"),
            (iamDb2,        $"UPDATE users SET tenant_id = '10000000-0000-0000-0000-000000000001' WHERE email = 'admin@nexuspos.com' AND tenant_id IS NULL"),
            (superAdminDb2, "ALTER TABLE superadmin.subscription_plans ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) NULL"),
        ];

        foreach ((DbContext ctx, string sql) in patches)
        {
            try
            {
                await ctx.Database.ExecuteSqlRawAsync(sql);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Schema patch skipped: {Patch}", sql[..Math.Min(sql.Length, 80)]);
            }
        }

        logger.LogDebug("Schema patches applied");
    }

    private static async Task SeedAdminUserAsync(IServiceProvider sp, ILogger logger)
    {
        IamDbContext db = sp.GetRequiredService<IamDbContext>();
        IPasswordService passwordService = sp.GetRequiredService<IPasswordService>();

        ErrorOr.ErrorOr<Email> emailResult = Email.Create(AdminEmail);
        if (emailResult.IsError) { return; }

        bool exists = await db.Users.AnyAsync(u => u.Email.Value == AdminEmail);
        if (exists)
        {
            logger.LogDebug("Admin user already exists, skipping seed");
            return;
        }

        User admin = User.Create(emailResult.Value, "Admin", "NexusPOS");
        admin.SetPassword(passwordService.HashPassword(AdminPassword));
        admin.AddRole(UserRole.Owner);
        admin.VerifyEmail();
        admin.ClearDomainEvents();

        db.Users.Add(admin);
        await db.SaveChangesAsync();

        logger.LogInformation("=======================================================");
        logger.LogInformation("Admin: {Email} / {Password}", AdminEmail, AdminPassword);
        logger.LogInformation("=======================================================");
    }

    private static async Task SeedSuperAdminUserAsync(IServiceProvider sp, ILogger logger)
    {
        IamDbContext db = sp.GetRequiredService<IamDbContext>();
        IPasswordService passwordService = sp.GetRequiredService<IPasswordService>();

        ErrorOr.ErrorOr<Email> emailResult = Email.Create(SuperAdminEmail);
        if (emailResult.IsError) { return; }

        bool exists = await db.Users.AnyAsync(u => u.Email.Value == SuperAdminEmail);
        if (exists)
        {
            logger.LogDebug("SuperAdmin user already exists, skipping seed");
            return;
        }

        User superAdmin = User.Create(emailResult.Value, "Super", "Admin");
        superAdmin.SetPassword(passwordService.HashPassword(SuperAdminPassword));
        superAdmin.RemoveRole(UserRole.Staff);
        superAdmin.AddRole(UserRole.SuperAdmin);
        superAdmin.VerifyEmail();
        superAdmin.ClearDomainEvents();

        db.Users.Add(superAdmin);
        await db.SaveChangesAsync();

        logger.LogInformation("=======================================================");
        logger.LogInformation("SuperAdmin: {Email} / {Password}", SuperAdminEmail, SuperAdminPassword);
        logger.LogInformation("=======================================================");
    }

    private static async Task SeedDefaultPlansAsync(IServiceProvider sp, ILogger logger)
    {
        SuperAdminDbContext db = sp.GetRequiredService<SuperAdminDbContext>();

        bool hasBusinessTypePlans = await db.SubscriptionPlans.AnyAsync(p => p.BusinessType != null);
        if (hasBusinessTypePlans)
        {
            logger.LogDebug("Business-type subscription plans already seeded, skipping");
            return;
        }

        // Clear old generic plans (if any) and re-seed per-business-type plans
        db.TenantSubscriptions.RemoveRange(db.TenantSubscriptions);
        db.SubscriptionPlans.RemoveRange(db.SubscriptionPlans);
        await db.SaveChangesAsync();

        SuperAdminPlan[] plans =
        [
            // ── Restaurant (مطعم) ────────────────────────────────────────────
            SuperAdminPlan.Create("أساسي مطعم", 299m, maxBranches: 1, maxUsers: 5,
            [
                "فرع واحد • 5 مستخدمين",
                "نقطة بيع للمطعم",
                "إدارة الطلبات والطاولات",
                "قائمة الطعام الرقمية",
                "ZATCA المرحلة الأولى",
                "تقارير المبيعات",
            ], "Restaurant"),
            SuperAdminPlan.Create("احترافي مطعم", 649m, maxBranches: 3, maxUsers: 15,
            [
                "3 فروع • 15 مستخدماً",
                "كل مميزات الأساسي",
                "نظام KDS للمطبخ",
                "إدارة الديليفري",
                "نقاط الولاء",
                "ZATCA المرحلة الثانية",
                "تقارير متقدمة",
            ], "Restaurant"),
            SuperAdminPlan.Create("مؤسسي مطعم", 1299m, maxBranches: 999, maxUsers: 50,
            [
                "فروع غير محدودة • 50 مستخدماً",
                "كل مميزات الاحترافي",
                "تكامل منصات التوصيل",
                "تحليلات BI متقدمة",
                "دعم 24/7",
            ], "Restaurant"),

            // ── Hotel (فندق) ─────────────────────────────────────────────────
            SuperAdminPlan.Create("أساسي فندق", 399m, maxBranches: 1, maxUsers: 5,
            [
                "فرع واحد • 5 مستخدمين",
                "إدارة الغرف والحجوزات",
                "تسجيل الدخول والخروج",
                "نقطة بيع الاستقبال",
                "ZATCA المرحلة الأولى",
                "تقارير الإشغال",
            ], "Hotel"),
            SuperAdminPlan.Create("احترافي فندق", 799m, maxBranches: 3, maxUsers: 15,
            [
                "3 فروع • 15 مستخدماً",
                "كل مميزات الأساسي",
                "إدارة خدمة الغرف",
                "نظام نقاط الولاء",
                "تقارير الإيرادات المتقدمة",
                "ZATCA المرحلة الثانية",
            ], "Hotel"),
            SuperAdminPlan.Create("مؤسسي فندق", 1599m, maxBranches: 999, maxUsers: 50,
            [
                "فروع غير محدودة • 50 مستخدماً",
                "كل مميزات الاحترافي",
                "تكامل أنظمة PMS",
                "تحليلات BI للإيرادات",
                "مدير حساب مخصص",
            ], "Hotel"),

            // ── Supermarket (سوبرماركت) ──────────────────────────────────────
            SuperAdminPlan.Create("أساسي سوبرماركت", 249m, maxBranches: 1, maxUsers: 5,
            [
                "فرع واحد • 5 مستخدمين",
                "نقطة بيع كاملة + سكنر",
                "إدارة المخزون والمنتجات",
                "تاريخ انتهاء الصلاحية",
                "ZATCA المرحلة الأولى",
                "تقارير المبيعات",
            ], "Supermarket"),
            SuperAdminPlan.Create("احترافي سوبرماركت", 549m, maxBranches: 3, maxUsers: 15,
            [
                "3 فروع • 15 مستخدماً",
                "كل مميزات الأساسي",
                "إدارة الموردين والمشتريات",
                "تنبيهات إعادة الطلب",
                "نظام العملاء CRM",
                "تقارير المخزون المتقدمة",
                "ZATCA المرحلة الثانية",
            ], "Supermarket"),
            SuperAdminPlan.Create("مؤسسي سوبرماركت", 999m, maxBranches: 999, maxUsers: 50,
            [
                "فروع غير محدودة • 50 مستخدماً",
                "كل مميزات الاحترافي",
                "تكامل ERP وأنظمة الجرد",
                "تحليلات BI متقدمة",
                "دعم 24/7",
            ], "Supermarket"),

            // ── Gaming (ألعاب) ───────────────────────────────────────────────
            SuperAdminPlan.Create("أساسي ألعاب", 199m, maxBranches: 1, maxUsers: 5,
            [
                "فرع واحد • 5 مستخدمين",
                "إدارة المحطات والأجهزة",
                "مؤقت الجلسات",
                "نقطة بيع أساسية",
                "ZATCA المرحلة الأولى",
                "تقارير الاستخدام",
            ], "Gaming"),
            SuperAdminPlan.Create("احترافي ألعاب", 449m, maxBranches: 3, maxUsers: 15,
            [
                "3 فروع • 15 مستخدماً",
                "كل مميزات الأساسي",
                "نقاط الولاء للاعبين",
                "بطاقات الاشتراك الشهرية",
                "تقارير الإيرادات المتقدمة",
                "ZATCA المرحلة الثانية",
            ], "Gaming"),
            SuperAdminPlan.Create("مؤسسي ألعاب", 899m, maxBranches: 999, maxUsers: 50,
            [
                "فروع غير محدودة • 50 مستخدماً",
                "كل مميزات الاحترافي",
                "تحليلات اللاعبين",
                "بطولات وأحداث",
                "دعم 24/7",
            ], "Gaming"),

            // ── Retail (تجزئة) ───────────────────────────────────────────────
            SuperAdminPlan.Create("أساسي تجزئة", 199m, maxBranches: 1, maxUsers: 5,
            [
                "فرع واحد • 5 مستخدمين",
                "نقطة بيع + سكنر باركود",
                "إدارة المنتجات والمخزون",
                "إيصالات ZATCA",
                "تقارير المبيعات",
            ], "Retail"),
            SuperAdminPlan.Create("احترافي تجزئة", 449m, maxBranches: 3, maxUsers: 15,
            [
                "3 فروع • 15 مستخدماً",
                "كل مميزات الأساسي",
                "إدارة الموردين",
                "نظام العملاء CRM",
                "أكواد الخصم والعروض",
                "تقارير متعددة الفروع",
            ], "Retail"),
            SuperAdminPlan.Create("مؤسسي تجزئة", 899m, maxBranches: 999, maxUsers: 50,
            [
                "فروع غير محدودة • 50 مستخدماً",
                "كل مميزات الاحترافي",
                "تكامل منصات البيع الإلكتروني",
                "تحليلات BI",
                "دعم 24/7",
            ], "Retail"),

            // ── Cafe (كافيه) ─────────────────────────────────────────────────
            SuperAdminPlan.Create("أساسي كافيه", 249m, maxBranches: 1, maxUsers: 5,
            [
                "فرع واحد • 5 مستخدمين",
                "نقطة بيع للكافيه",
                "إدارة القائمة والوصفات",
                "إدارة الطاولات",
                "ZATCA المرحلة الأولى",
                "تقارير المبيعات",
            ], "Cafe"),
            SuperAdminPlan.Create("احترافي كافيه", 549m, maxBranches: 3, maxUsers: 15,
            [
                "3 فروع • 15 مستخدماً",
                "كل مميزات الأساسي",
                "نظام الولاء والنقاط",
                "إدارة المواد الخام",
                "تقارير الإيرادات المتقدمة",
                "ZATCA المرحلة الثانية",
            ], "Cafe"),
            SuperAdminPlan.Create("مؤسسي كافيه", 999m, maxBranches: 999, maxUsers: 30,
            [
                "فروع غير محدودة • 30 مستخدماً",
                "كل مميزات الاحترافي",
                "تكامل منصات التوصيل",
                "تحليلات BI",
                "دعم 24/7",
            ], "Cafe"),
        ];

        db.SubscriptionPlans.AddRange(plans);
        await db.SaveChangesAsync();

        logger.LogInformation("Seeded {Count} business-type subscription plans", plans.Length);
    }

    private static async Task SeedMultiTypeDemoTenantsAsync(IServiceProvider sp, ILogger logger)
    {
        OrganizationDbContext orgDb = sp.GetRequiredService<OrganizationDbContext>();

        Guid restaurantTenantId = new("10000000-0000-0000-0000-000000000002");
        bool alreadySeeded = await orgDb.Tenants.AnyAsync(t => t.Id == new TenantId(restaurantTenantId));
        if (alreadySeeded)
        {
            logger.LogDebug("Multi-type demo tenants already seeded, skipping");
            return;
        }

        IamDbContext iamDb = sp.GetRequiredService<IamDbContext>();
        IPasswordService passwordService = sp.GetRequiredService<IPasswordService>();

        (Guid id, Guid branchId, string name, string subdomain, string email, BusinessType bizType, BranchType branchType)[] entries =
        [
            (restaurantTenantId,                             new("20000000-0000-0000-0000-000000000002"),
             "نكسس للمطاعم",  "nexus-restaurant", "admin.rest@nexuspos.com",   BusinessType.Restaurant, BranchType.Restaurant),
            (new("10000000-0000-0000-0000-000000000003"),   new("20000000-0000-0000-0000-000000000003"),
             "نكسس للفنادق",  "nexus-hotel",      "admin.hotel@nexuspos.com",  BusinessType.Hotel,      BranchType.Hotel),
            (new("10000000-0000-0000-0000-000000000004"),   new("20000000-0000-0000-0000-000000000004"),
             "نكسس للألعاب",  "nexus-gaming",     "admin.gaming@nexuspos.com", BusinessType.Gaming,     BranchType.Gaming),
            (new("10000000-0000-0000-0000-000000000005"),   new("20000000-0000-0000-0000-000000000005"),
             "نكسس للتجزئة",  "nexus-retail",     "admin.retail@nexuspos.com", BusinessType.Retail,     BranchType.Retail),
            (new("10000000-0000-0000-0000-000000000006"),   new("20000000-0000-0000-0000-000000000006"),
             "نكسس كافيه",    "nexus-cafe",       "admin.cafe@nexuspos.com",   BusinessType.Cafe,       BranchType.Restaurant),
        ];

        foreach ((Guid id, Guid branchId, string name, string subdomain, string email, BusinessType bizType, BranchType branchType) in entries)
        {
            Tenant tenant = Tenant.CreateWithId(
                id, name, subdomain, email, "SAR", "Asia/Riyadh", bizType);
            tenant.ClearDomainEvents();
            orgDb.Tenants.Add(tenant);

            Branch branch = Branch.CreateWithId(
                branchId, new TenantId(id), "الفرع الرئيسي", branchType, isMainBranch: true);
            branch.ClearDomainEvents();
            orgDb.Branches.Add(branch);

            ErrorOr.ErrorOr<Email> emailResult = Email.Create(email);
            if (emailResult.IsError) { continue; }

            bool userExists = await iamDb.Users.AnyAsync(u => u.Email.Value == email);
            if (!userExists)
            {
                User user = User.Create(emailResult.Value, "Admin", name, id);
                user.SetPassword(passwordService.HashPassword(DemoAdminPassword));
                user.AddRole(UserRole.Owner);
                user.VerifyEmail();
                user.ClearDomainEvents();
                iamDb.Users.Add(user);
            }
        }

        await orgDb.SaveChangesAsync();
        await iamDb.SaveChangesAsync();

        logger.LogInformation("=======================================================");
        logger.LogInformation("Demo Tenant Credentials (password: {Password}):", DemoAdminPassword);
        logger.LogInformation("  Supermarket : admin@nexuspos.com");
        logger.LogInformation("  Restaurant  : admin.rest@nexuspos.com");
        logger.LogInformation("  Hotel       : admin.hotel@nexuspos.com");
        logger.LogInformation("  Gaming      : admin.gaming@nexuspos.com");
        logger.LogInformation("  Retail      : admin.retail@nexuspos.com");
        logger.LogInformation("  Cafe        : admin.cafe@nexuspos.com");
        logger.LogInformation("=======================================================");
    }

    private static async Task SeedDemoDataAsync(IServiceProvider sp, ILogger logger)
    {
        OrganizationDbContext orgDb = sp.GetRequiredService<OrganizationDbContext>();
        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();
        InventoryDbContext inventoryDb = sp.GetRequiredService<InventoryDbContext>();
        CrmDbContext crmDb = sp.GetRequiredService<CrmDbContext>();
        PurchasingDbContext purchasingDb = sp.GetRequiredService<PurchasingDbContext>();

        bool tenantExists = await orgDb.Tenants.AnyAsync(t => t.Id == new TenantId(_demoTenantId));
        if (tenantExists)
        {
            logger.LogDebug("Demo data already seeded, skipping");
            return;
        }

        logger.LogInformation("Seeding demo data...");

        // ── Tenant ───────────────────────────────────────────────────────────
        Tenant tenant = Tenant.CreateWithId(
            _demoTenantId, "نكسس للمبيعات", "nexuspos", AdminEmail, "SAR", "Asia/Riyadh", BusinessType.Supermarket);
        tenant.UpdateProfile(
            "نكسس للمبيعات", "SAR", "Asia/Riyadh",
            logoUrl: null, phoneNumber: "+966500000000", taxId: "300000000000003");
        tenant.ClearDomainEvents();
        orgDb.Tenants.Add(tenant);

        // ── Branch ───────────────────────────────────────────────────────────
        Branch branch = Branch.CreateWithId(
            _demoBranchId, new TenantId(_demoTenantId), "الفرع الرئيسي", BranchType.Retail, isMainBranch: true);
        branch.ClearDomainEvents();
        orgDb.Branches.Add(branch);

        await orgDb.SaveChangesAsync();
        logger.LogInformation("Seeded tenant and branch");

        // ── Categories ───────────────────────────────────────────────────────
        Category catFood = Category.Create("مواد غذائية");
        Category catBev = Category.Create("مشروبات");
        Category catElec = Category.Create("إلكترونيات");
        Category catCare = Category.Create("عناية شخصية");
        Category catHome = Category.Create("منزل ومطبخ");
        catFood.ClearDomainEvents();
        catBev.ClearDomainEvents();
        catElec.ClearDomainEvents();
        catCare.ClearDomainEvents();
        catHome.ClearDomainEvents();
        catalogDb.Categories.AddRange(catFood, catBev, catElec, catCare, catHome);
        await catalogDb.SaveChangesAsync();
        logger.LogInformation("Seeded 5 categories");

        // ── Products (15 items) ───────────────────────────────────────────────
        List<(Product product, decimal qty)> products =
        [
            // Food (5)
            CreateProduct(catalogDb, "أرز بسمتي ممتاز", "أرز بسمتي طويل الحبة، كيلو", catFood.Id.Value, "ARZ-001", "كيس 1 كيلو", 8m, 12m, 200, "6281234500001"),
            CreateProduct(catalogDb, "زيت عباد الشمس", "زيت نباتي صافٍ، 1.5 لتر", catFood.Id.Value, "ZYT-001", "زجاجة 1.5 لتر", 12m, 18m, 150, "6281234500002"),
            CreateProduct(catalogDb, "سكر أبيض", "سكر أبيض ناعم", catFood.Id.Value, "SKR-001", "كيس 1 كيلو", 4m, 6m, 300, "6281234500003"),
            CreateProduct(catalogDb, "دقيق القمح", "دقيق قمح للمخبوزات", catFood.Id.Value, "DQQ-001", "كيس 2 كيلو", 7m, 10m, 250, "6281234500004"),
            CreateProduct(catalogDb, "تمر عجوة فاخر", "تمر عجوة ممتاز من المدينة المنورة", catFood.Id.Value, "TMR-001", "علبة 500 غرام", 35m, 55m, 80, "6281234500005"),
            // Beverages (3)
            CreateProduct(catalogDb, "مياه معدنية", "مياه شرب طبيعية", catBev.Id.Value, "MYH-001", "زجاجة 500 مل", 1m, 2m, 500, "6281234500006"),
            CreateProduct(catalogDb, "عصير برتقال", "عصير برتقال 100% طبيعي", catBev.Id.Value, "ASR-001", "زجاجة 1 لتر", 8m, 14m, 120, "6281234500007"),
            CreateProduct(catalogDb, "قهوة عربية", "قهوة عربية بالهيل، 250 غرام", catBev.Id.Value, "QHW-001", "علبة 250 غرام", 22m, 35m, 90, "6281234500008"),
            // Electronics (3)
            CreateProduct(catalogDb, "سماعة بلوتوث", "سماعة لاسلكية بجودة عالية", catElec.Id.Value, "SME-001", "قطعة", 80m, 149m, 40, "6281234500009"),
            CreateProduct(catalogDb, "شاحن سريع USB-C", "شاحن 65 واط", catElec.Id.Value, "SHA-001", "قطعة", 35m, 65m, 60, "6281234500010"),
            CreateProduct(catalogDb, "كابل HDMI 4K", "كابل HDMI، طول 2 متر", catElec.Id.Value, "CBL-001", "قطعة", 18m, 35m, 75, "6281234500011"),
            // Personal Care (2)
            CreateProduct(catalogDb, "شامبو عناية بالشعر", "للشعر الجاف والتالف", catCare.Id.Value, "SHM-001", "زجاجة 400 مل", 22m, 38m, 100, "6281234500012"),
            CreateProduct(catalogDb, "معجون أسنان", "بالفلورايد والنعناع", catCare.Id.Value, "MGN-001", "أنبوب 150 مل", 12m, 20m, 150, "6281234500013"),
            // Home (2)
            CreateProduct(catalogDb, "صابون غسيل أطباق", "برائحة الليمون", catHome.Id.Value, "SBN-001", "زجاجة 750 مل", 7m, 13m, 200, "6281234500014"),
            CreateProduct(catalogDb, "أكياس قمامة", "أكياس قمامة سميكة، 30 كيس", catHome.Id.Value, "KYS-001", "ربطة 30 كيس", 10m, 18m, 180, "6281234500015"),
        ];

        await catalogDb.SaveChangesAsync();
        logger.LogInformation("Seeded 15 products");

        // ── Stock Items ───────────────────────────────────────────────────────
        foreach ((Product product, decimal qty) in products)
        {
            ProductVariant variant = product.Variants.First();
            StockItem stock = StockItem.Create(variant.Id.Value, _demoBranchId, reorderPoint: 10, reorderQuantity: 50);
            stock.Receive(qty, "seed", "بيانات تجريبية أولية");
            stock.ClearDomainEvents();
            inventoryDb.StockItems.Add(stock);
        }

        await inventoryDb.SaveChangesAsync();
        logger.LogInformation("Seeded stock items");

        // ── Customers ─────────────────────────────────────────────────────────
        Customer[] customers =
        [
            Customer.Create(_demoTenantId, "محمد عبدالله السعيد", "mohammed@example.sa", "+966501111111", "الرياض، حي النخيل"),
            Customer.Create(_demoTenantId, "فاطمة عمر الغامدي", "fatima@example.sa", "+966502222222", "جدة، حي الزهراء"),
            Customer.Create(_demoTenantId, "أحمد خالد العتيبي", "ahmed@example.sa", "+966503333333", "مكة المكرمة"),
            Customer.Create(_demoTenantId, "نورا يوسف القحطاني", "noura@example.sa", "+966504444444", "الدمام"),
            Customer.Create(_demoTenantId, "عبدالعزيز سالم الدوسري", null, "+966505555555", "الخبر"),
        ];

        foreach (Customer c in customers)
        {
            c.ClearDomainEvents();
        }

        crmDb.Customers.AddRange(customers);
        await crmDb.SaveChangesAsync();
        logger.LogInformation("Seeded 5 customers");

        // ── Suppliers ─────────────────────────────────────────────────────────
        Supplier[] suppliers =
        [
            Supplier.Create(_demoTenantId, "شركة الجزيرة للتوزيع", "info@jazira-dist.sa", "+966112345678", "الرياض"),
            Supplier.Create(_demoTenantId, "مؤسسة النجمة للتجارة", "sales@nejma.sa", "+966126789012", "جدة"),
            Supplier.Create(_demoTenantId, "شركة الخليج للإلكترونيات", "orders@gulf-elec.sa", "+966133456789", "الدمام"),
        ];

        purchasingDb.Suppliers.AddRange(suppliers);
        await purchasingDb.SaveChangesAsync();
        logger.LogInformation("Seeded 3 suppliers");

        logger.LogInformation("✅ Demo data seeded successfully");
    }

    private static (Product, decimal) CreateProduct(
        CatalogDbContext db,
        string name,
        string description,
        Guid categoryId,
        string sku,
        string variantName,
        decimal costPrice,
        decimal salePrice,
        decimal initialQty,
        string? barcode = null)
    {
        Product product = Product.Create(
            name,
            description,
            new NexusPOS.Catalog.Domain.ValueObjects.CategoryId(categoryId),
            ProductType.Standard,
            TaxClass.Standard,
            trackInventory: true);

        NexusPOS.Catalog.Domain.ValueObjects.Sku skuVo = NexusPOS.Catalog.Domain.ValueObjects.Sku.Create(sku).Value;
        NexusPOS.Catalog.Domain.ValueObjects.Money costVo = NexusPOS.Catalog.Domain.ValueObjects.Money.Create(costPrice, "SAR").Value;
        NexusPOS.Catalog.Domain.ValueObjects.Money saleVo = NexusPOS.Catalog.Domain.ValueObjects.Money.Create(salePrice, "SAR").Value;

        product.AddVariant(skuVo, variantName, costVo, saleVo, barcode);
        product.ClearDomainEvents();
        db.Products.Add(product);
        return (product, initialQty);
    }

    private static async Task SeedHotelDemoDataAsync(IServiceProvider sp, ILogger logger)
    {
        HotelDbContext db = sp.GetRequiredService<HotelDbContext>();

        bool exists = await db.Rooms.AnyAsync();
        if (exists)
        {
            logger.LogDebug("Hotel demo rooms already seeded, skipping");
            return;
        }

        (RoomType type, string number, int floor, int capacity, decimal rate, string desc)[] rooms =
        [
            (RoomType.Standard,     "101", 1, 2, 250m,  "غرفة قياسية مريحة بإطلالة على الحديقة"),
            (RoomType.Standard,     "102", 1, 2, 250m,  "غرفة قياسية مريحة بسرير مزدوج"),
            (RoomType.Standard,     "103", 1, 2, 250m,  "غرفة قياسية بسريرين منفصلين"),
            (RoomType.Deluxe,       "201", 2, 3, 450m,  "غرفة ديلوكس بإطلالة بانورامية"),
            (RoomType.Deluxe,       "202", 2, 3, 450m,  "غرفة ديلوكس فاخرة مع جاكوزي"),
            (RoomType.Suite,        "301", 3, 4, 800m,  "جناح فاخر بغرفة معيشة مستقلة"),
            (RoomType.Suite,        "302", 3, 4, 800m,  "جناح تنفيذي بإطلالة على المدينة"),
            (RoomType.Presidential, "401", 4, 6, 1800m, "الجناح الرئاسي — الطابق الكامل"),
        ];

        foreach ((RoomType type, string number, int floor, int capacity, decimal rate, string desc) in rooms)
        {
            ErrorOr.ErrorOr<Room> result = Room.Create(_demoTenantId, _demoBranchId, type, number, floor, capacity, rate, "SAR", desc);
            if (!result.IsError)
            {
                result.Value.ClearDomainEvents();
                db.Rooms.Add(result.Value);
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} hotel rooms", rooms.Length);
    }

    private static async Task SeedExpiryDemoDataAsync(IServiceProvider sp, ILogger logger)
    {
        InventoryDbContext inventoryDb = sp.GetRequiredService<InventoryDbContext>();
        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();

        bool alreadyDone = await inventoryDb.StockItems
            .AnyAsync(s => s.BranchId == _demoBranchId && s.ExpiryDate != null);
        if (alreadyDone)
        {
            logger.LogDebug("Expiry demo data already seeded, skipping");
            return;
        }

        // Near-expiry dates: past (expired), within 3 days, within 7 days, within 30 days
        DateTime now = DateTime.UtcNow;
        (string sku, DateTime expiry)[] expiryMap =
        [
            ("ZYT-001", now.AddDays(-2)),   // زيت عباد الشمس — منتهي الصلاحية
            ("ARZ-001", now.AddDays(3)),     // أرز — ينتهي خلال 3 أيام
            ("MYH-001", now.AddDays(6)),     // مياه معدنية — ينتهي خلال 6 أيام
            ("ASR-001", now.AddDays(12)),    // عصير برتقال — ينتهي خلال 12 يوم
            ("SKR-001", now.AddDays(25)),    // سكر — ينتهي خلال 25 يوم
            ("QHW-001", now.AddDays(45)),    // قهوة — ينتهي خلال 45 يوم
        ];

        foreach ((string sku, DateTime expiry) in expiryMap)
        {
            NexusPOS.Catalog.Domain.Entities.ProductVariant? variant = await catalogDb.Set<NexusPOS.Catalog.Domain.Entities.ProductVariant>()
                .FirstOrDefaultAsync(v => v.Sku.Value == sku);
            if (variant is null) { continue; }

            StockItem? stock = await inventoryDb.StockItems
                .FirstOrDefaultAsync(s => s.VariantId == variant.Id.Value && s.BranchId == _demoBranchId);
            if (stock is null) { continue; }

            stock.SetExpiryDate(expiry);
        }

        await inventoryDb.SaveChangesAsync();
        logger.LogInformation("Seeded expiry dates for {Count} demo stock items", expiryMap.Length);
    }

    private static async Task SeedGamingDemoDataAsync(IServiceProvider sp, ILogger logger)
    {
        GamingDbContext db = sp.GetRequiredService<GamingDbContext>();

        bool exists = await db.GameStations.AnyAsync();
        if (exists)
        {
            logger.LogDebug("Gaming demo stations already seeded, skipping");
            return;
        }

        (StationType type, string name, decimal rate)[] stations =
        [
            (StationType.Console, "PlayStation 5 — طاولة 1",  30m),
            (StationType.Console, "PlayStation 5 — طاولة 2",  30m),
            (StationType.Console, "Xbox Series X — طاولة 3",  30m),
            (StationType.PC,      "PC Gaming — محطة 1",        25m),
            (StationType.PC,      "PC Gaming — محطة 2",        25m),
            (StationType.PC,      "PC Gaming — محطة 3",        25m),
            (StationType.VR,      "Meta Quest 3 — VR",         50m),
            (StationType.Arcade,  "ملاكمة VR — Arcade",        40m),
        ];

        foreach ((StationType type, string name, decimal rate) in stations)
        {
            ErrorOr.ErrorOr<GameStation> result = GameStation.Create(_demoTenantId, _demoBranchId, type, name, rate, "SAR");
            if (!result.IsError)
            {
                db.GameStations.Add(result.Value);
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} gaming stations", stations.Length);
    }

    // ── Per-tenant schema provisioning ────────────────────────────────────────
    // Each demo tenant gets its own PostgreSQL schema (tenant_XXXX) with its own
    // tables and seed data, implementing true schema-per-tenant isolation.

    private static async Task ProvisionTenantSchemasAsync(IServiceProvider rootSp, ILogger logger)
    {
        (Guid tenantId, Guid branchId, BusinessType bizType)[] tenants =
        [
            (_demoTenantId,                                  new("20000000-0000-0000-0000-000000000001"), BusinessType.Supermarket),
            (new("10000000-0000-0000-0000-000000000002"),   new("20000000-0000-0000-0000-000000000002"), BusinessType.Restaurant),
            (new("10000000-0000-0000-0000-000000000003"),   new("20000000-0000-0000-0000-000000000003"), BusinessType.Hotel),
            (new("10000000-0000-0000-0000-000000000004"),   new("20000000-0000-0000-0000-000000000004"), BusinessType.Gaming),
            (new("10000000-0000-0000-0000-000000000005"),   new("20000000-0000-0000-0000-000000000005"), BusinessType.Retail),
            (new("10000000-0000-0000-0000-000000000006"),   new("20000000-0000-0000-0000-000000000006"), BusinessType.Cafe),
        ];

        foreach ((Guid tenantId, Guid branchId, BusinessType bizType) in tenants)
        {
            try
            {
                using IServiceScope scope = rootSp.CreateScope();
                IServiceProvider sp = scope.ServiceProvider;

                MutableTenantContext tenantCtx = sp.GetRequiredService<MutableTenantContext>();
                tenantCtx.TenantId = tenantId;
                tenantCtx.SchemaName = $"tenant_{tenantId:N}";
                tenantCtx.IsAuthenticated = true;
                tenantCtx.BranchId = branchId;

                CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();

                // Create the PostgreSQL schema for this tenant
                string createSchemaSql = "CREATE SCHEMA IF NOT EXISTS \"" + tenantCtx.SchemaName + "\"";
                await catalogDb.Database.ExecuteSqlRawAsync(createSchemaSql);

                // Provision all tenant-specific module tables in this schema
                await EnsureCreatedAsync<CatalogDbContext>(sp, logger);
                await EnsureCreatedAsync<InventoryDbContext>(sp, logger);
                await EnsureCreatedAsync<PosDbContext>(sp, logger);
                await EnsureCreatedAsync<SalesDbContext>(sp, logger);
                await EnsureCreatedAsync<CrmDbContext>(sp, logger);
                await EnsureCreatedAsync<PurchasingDbContext>(sp, logger);
                await EnsureCreatedAsync<FinanceDbContext>(sp, logger);
                await EnsureCreatedAsync<ZatcaDbContext>(sp, logger);

                if (bizType is BusinessType.Restaurant or BusinessType.Cafe)
                {
                    await EnsureCreatedAsync<RestaurantDbContext>(sp, logger);
                }

                if (bizType == BusinessType.Hotel)
                {
                    await EnsureCreatedAsync<HotelDbContext>(sp, logger);
                }

                if (bizType == BusinessType.Gaming)
                {
                    await EnsureCreatedAsync<GamingDbContext>(sp, logger);
                }

                // Seed demo data (idempotent — guard per business type)
                bool alreadySeeded = bizType switch
                {
                    BusinessType.Hotel => await sp.GetRequiredService<HotelDbContext>().Rooms.AnyAsync(),
                    BusinessType.Gaming => await sp.GetRequiredService<GamingDbContext>().GameStations.AnyAsync(),
                    _ => await catalogDb.Categories.AnyAsync(),
                };

                if (!alreadySeeded)
                {
                    await SeedTenantDemoDataAsync(sp, tenantId, branchId, bizType, logger);
                }

                logger.LogInformation("Provisioned tenant schema {Schema}", tenantCtx.SchemaName);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to provision schema for tenant {TenantId}", tenantId);
                throw;
            }
        }
    }

    private static Task SeedTenantDemoDataAsync(
        IServiceProvider sp, Guid tenantId, Guid branchId, BusinessType bizType, ILogger logger) =>
        bizType switch
        {
            BusinessType.Supermarket => SeedSupermarketTenantAsync(sp, branchId, logger),
            BusinessType.Restaurant => SeedRestaurantTenantAsync(sp, logger),
            BusinessType.Hotel => SeedHotelTenantAsync(sp, tenantId, branchId, logger),
            BusinessType.Gaming => SeedGamingTenantAsync(sp, tenantId, branchId, logger),
            BusinessType.Retail => SeedRetailTenantAsync(sp, branchId, logger),
            BusinessType.Cafe => SeedCafeTenantAsync(sp, logger),
            _ => Task.CompletedTask,
        };

    private static async Task SeedSupermarketTenantAsync(IServiceProvider sp, Guid branchId, ILogger logger)
    {
        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();
        InventoryDbContext inventoryDb = sp.GetRequiredService<InventoryDbContext>();

        Category catFood = Category.Create("مواد غذائية");
        Category catBev = Category.Create("مشروبات");
        Category catElec = Category.Create("إلكترونيات");
        Category catCare = Category.Create("عناية شخصية");
        Category catHome = Category.Create("منزل ومطبخ");
        catFood.ClearDomainEvents(); catBev.ClearDomainEvents(); catElec.ClearDomainEvents();
        catCare.ClearDomainEvents(); catHome.ClearDomainEvents();
        catalogDb.Categories.AddRange(catFood, catBev, catElec, catCare, catHome);
        await catalogDb.SaveChangesAsync();

        List<(Product product, decimal qty)> products =
        [
            CreateProduct(catalogDb, "أرز بسمتي ممتاز",    "أرز بسمتي طويل الحبة، كيلو",                catFood.Id.Value, "ARZ-001", "كيس 1 كيلو",    8m,  12m,  200, "6281234500001"),
            CreateProduct(catalogDb, "زيت عباد الشمس",     "زيت نباتي صافٍ، 1.5 لتر",                    catFood.Id.Value, "ZYT-001", "زجاجة 1.5 لتر", 12m, 18m,  150, "6281234500002"),
            CreateProduct(catalogDb, "سكر أبيض",            "سكر أبيض ناعم",                               catFood.Id.Value, "SKR-001", "كيس 1 كيلو",    4m,  6m,   300, "6281234500003"),
            CreateProduct(catalogDb, "دقيق القمح",          "دقيق قمح للمخبوزات",                          catFood.Id.Value, "DQQ-001", "كيس 2 كيلو",    7m,  10m,  250, "6281234500004"),
            CreateProduct(catalogDb, "تمر عجوة فاخر",       "تمر عجوة ممتاز من المدينة المنورة",            catFood.Id.Value, "TMR-001", "علبة 500 غرام", 35m, 55m,  80,  "6281234500005"),
            CreateProduct(catalogDb, "مياه معدنية",         "مياه شرب طبيعية",                             catBev.Id.Value,  "MYH-001", "زجاجة 500 مل",  1m,  2m,   500, "6281234500006"),
            CreateProduct(catalogDb, "عصير برتقال",         "عصير برتقال 100% طبيعي",                      catBev.Id.Value,  "ASR-001", "زجاجة 1 لتر",   8m,  14m,  120, "6281234500007"),
            CreateProduct(catalogDb, "قهوة عربية",          "قهوة عربية بالهيل، 250 غرام",                 catBev.Id.Value,  "QHW-001", "علبة 250 غرام", 22m, 35m,  90,  "6281234500008"),
            CreateProduct(catalogDb, "سماعة بلوتوث",        "سماعة لاسلكية بجودة عالية",                   catElec.Id.Value, "SME-001", "قطعة",          80m, 149m, 40,  "6281234500009"),
            CreateProduct(catalogDb, "شاحن سريع USB-C",     "شاحن 65 واط",                                 catElec.Id.Value, "SHA-001", "قطعة",          35m, 65m,  60,  "6281234500010"),
            CreateProduct(catalogDb, "كابل HDMI 4K",        "كابل HDMI، طول 2 متر",                        catElec.Id.Value, "CBL-001", "قطعة",          18m, 35m,  75,  "6281234500011"),
            CreateProduct(catalogDb, "شامبو عناية بالشعر",  "للشعر الجاف والتالف",                         catCare.Id.Value, "SHM-001", "زجاجة 400 مل",  22m, 38m,  100, "6281234500012"),
            CreateProduct(catalogDb, "معجون أسنان",         "بالفلورايد والنعناع",                          catCare.Id.Value, "MGN-001", "أنبوب 150 مل",  12m, 20m,  150, "6281234500013"),
            CreateProduct(catalogDb, "صابون غسيل أطباق",   "برائحة الليمون",                               catHome.Id.Value, "SBN-001", "زجاجة 750 مل",  7m,  13m,  200, "6281234500014"),
            CreateProduct(catalogDb, "أكياس قمامة",         "أكياس قمامة سميكة، 30 كيس",                   catHome.Id.Value, "KYS-001", "ربطة 30 كيس",   10m, 18m,  180, "6281234500015"),
        ];

        await catalogDb.SaveChangesAsync();

        foreach ((Product product, decimal qty) in products)
        {
            ProductVariant variant = product.Variants.First();
            StockItem stock = StockItem.Create(variant.Id.Value, branchId, reorderPoint: 10, reorderQuantity: 50);
            stock.Receive(qty, "seed", "بيانات تجريبية أولية");
            stock.ClearDomainEvents();
            inventoryDb.StockItems.Add(stock);
        }
        await inventoryDb.SaveChangesAsync();

        logger.LogInformation("Seeded supermarket catalog ({Count} products)", products.Count);
    }

    private static async Task SeedCafeTenantAsync(IServiceProvider sp, ILogger logger)
    {
        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();

        Category catHot = Category.Create("مشروبات ساخنة");
        Category catCold = Category.Create("مشروبات باردة");
        Category catBake = Category.Create("معجنات وحلويات");
        Category catFood = Category.Create("وجبات خفيفة");
        catHot.ClearDomainEvents(); catCold.ClearDomainEvents();
        catBake.ClearDomainEvents(); catFood.ClearDomainEvents();
        catalogDb.Categories.AddRange(catHot, catCold, catBake, catFood);
        await catalogDb.SaveChangesAsync();

        // Hot drinks
        CreateMenuItem(catalogDb, "قهوة عربية", "قهوة عربية أصيلة بالهيل", catHot.Id.Value, "CF-001", "كوب", 8m);
        CreateMenuItem(catalogDb, "اسبريسو", "شوت اسبريسو مركز", catHot.Id.Value, "CF-002", "كوب", 10m);
        CreateMenuItem(catalogDb, "كابتشينو", "اسبريسو مع رغوة الحليب", catHot.Id.Value, "CF-003", "كوب", 16m);
        CreateMenuItem(catalogDb, "لاتيه", "اسبريسو مع حليب مبخر", catHot.Id.Value, "CF-004", "كوب", 16m);
        CreateMenuItem(catalogDb, "أمريكانو", "اسبريسو مخفف بالماء الساخن", catHot.Id.Value, "CF-005", "كوب", 12m);
        CreateMenuItem(catalogDb, "موكا", "اسبريسو مع شوكولاتة وحليب", catHot.Id.Value, "CF-006", "كوب", 18m);
        CreateMenuItem(catalogDb, "شاي أحمر", "شاي أحمر بالحليب", catHot.Id.Value, "CF-007", "كوب", 8m);
        CreateMenuItem(catalogDb, "شاي أخضر", "شاي أخضر بالنعناع", catHot.Id.Value, "CF-008", "كوب", 8m);
        // Cold drinks
        CreateMenuItem(catalogDb, "قهوة مثلجة", "قهوة باردة مع الثلج", catCold.Id.Value, "CLD-001", "كوب", 18m);
        CreateMenuItem(catalogDb, "فرابتشينو", "مشروب قهوة مثلج كريمي", catCold.Id.Value, "CLD-002", "كوب", 22m);
        CreateMenuItem(catalogDb, "عصير برتقال", "عصير برتقال طازج", catCold.Id.Value, "CLD-003", "كوب", 14m);
        CreateMenuItem(catalogDb, "موهيتو مثلج", "مشروب منعش بالنعناع والليمون", catCold.Id.Value, "CLD-004", "كوب", 16m);
        // Pastries & Sweets
        CreateMenuItem(catalogDb, "كرواسان", "كرواسان زبدي طازج", catBake.Id.Value, "BK-001", "قطعة", 12m);
        CreateMenuItem(catalogDb, "مافن شوكولاتة", "مافن بالشوكولاتة الداكنة", catBake.Id.Value, "BK-002", "قطعة", 14m);
        CreateMenuItem(catalogDb, "كيك لوتس", "كيك بكريمة لوتس", catBake.Id.Value, "BK-003", "شريحة", 20m);
        CreateMenuItem(catalogDb, "تشيز كيك", "تشيز كيك بالتوت", catBake.Id.Value, "BK-004", "شريحة", 22m);
        CreateMenuItem(catalogDb, "دونات سادة", "دونات بالسكر البودرة", catBake.Id.Value, "BK-005", "قطعة", 8m);
        // Light meals
        CreateMenuItem(catalogDb, "سندويش دجاج", "سندويش دجاج مشوي بالخضروات", catFood.Id.Value, "LM-001", "سندويش", 22m);
        CreateMenuItem(catalogDb, "كلاب هوت", "نقانق في خبز هوت دوق", catFood.Id.Value, "LM-002", "قطعة", 18m);
        CreateMenuItem(catalogDb, "بيتزا شخصية", "بيتزا صغيرة بالجبن والخضروات", catFood.Id.Value, "LM-003", "قطعة", 25m);

        await catalogDb.SaveChangesAsync();
        logger.LogInformation("Seeded cafe catalog (20 items)");
    }

    private static async Task SeedRestaurantTenantAsync(IServiceProvider sp, ILogger logger)
    {
        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();

        Category catApp = Category.Create("مقبلات");
        Category catMain = Category.Create("أطباق رئيسية");
        Category catBev = Category.Create("مشروبات");
        Category catDes = Category.Create("حلويات");
        catApp.ClearDomainEvents(); catMain.ClearDomainEvents();
        catBev.ClearDomainEvents(); catDes.ClearDomainEvents();
        catalogDb.Categories.AddRange(catApp, catMain, catBev, catDes);
        await catalogDb.SaveChangesAsync();

        // Appetizers
        CreateMenuItem(catalogDb, "شوربة عدس", "شوربة عدس بالكمون والليمون", catApp.Id.Value, "RST-001", "طبق", 12m);
        CreateMenuItem(catalogDb, "سلطة فتوش", "سلطة خضراء بالخضروات الطازجة", catApp.Id.Value, "RST-002", "طبق", 15m);
        CreateMenuItem(catalogDb, "حمص بالطحينة", "حمص كريمي مع زيت الزيتون", catApp.Id.Value, "RST-003", "طبق", 14m);
        CreateMenuItem(catalogDb, "متبل", "متبل الباذنجان المشوي", catApp.Id.Value, "RST-004", "طبق", 14m);
        // Main courses
        CreateMenuItem(catalogDb, "كبسة دجاج", "أرز كبسة بالدجاج والبهارات", catMain.Id.Value, "RST-010", "طبق", 35m);
        CreateMenuItem(catalogDb, "مجبوس لحم", "أرز مجبوس مع اللحم", catMain.Id.Value, "RST-011", "طبق", 45m);
        CreateMenuItem(catalogDb, "مندي خروف", "خروف بالأرز على الطريقة اليمنية", catMain.Id.Value, "RST-012", "طبق", 65m);
        CreateMenuItem(catalogDb, "شاورما دجاج", "شاورما دجاج بالثوم والمخلل", catMain.Id.Value, "RST-013", "ساندويش", 22m);
        CreateMenuItem(catalogDb, "مشاوي مشكلة", "تشكيلة مشاوي اللحم والدجاج", catMain.Id.Value, "RST-014", "طبق", 75m);
        CreateMenuItem(catalogDb, "أرز بسمتي", "أرز بسمتي مطبوخ بالزبدة", catMain.Id.Value, "RST-015", "طبق", 10m);
        // Beverages
        CreateMenuItem(catalogDb, "شاي بالنعناع", "شاي طازج بالنعناع", catBev.Id.Value, "RST-020", "كوب", 6m);
        CreateMenuItem(catalogDb, "عصير مانجو", "عصير مانجو طبيعي", catBev.Id.Value, "RST-021", "كوب", 10m);
        CreateMenuItem(catalogDb, "قهوة عربية", "قهوة عربية بالهيل", catBev.Id.Value, "RST-022", "فنجان", 5m);
        CreateMenuItem(catalogDb, "لبن رائب", "لبن طازج بارد", catBev.Id.Value, "RST-023", "كوب", 6m);
        // Desserts
        CreateMenuItem(catalogDb, "أم علي", "حلوى الأم علي بالكريمة والمكسرات", catDes.Id.Value, "RST-030", "طبق", 18m);
        CreateMenuItem(catalogDb, "مهلبية", "مهلبية بالورد والفستق", catDes.Id.Value, "RST-031", "طبق", 12m);
        CreateMenuItem(catalogDb, "كنافة", "كنافة بالجبن والقطر", catDes.Id.Value, "RST-032", "قطعة", 20m);

        await catalogDb.SaveChangesAsync();
        logger.LogInformation("Seeded restaurant catalog (17 items)");
    }

    private static async Task SeedRetailTenantAsync(IServiceProvider sp, Guid branchId, ILogger logger)
    {
        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();
        InventoryDbContext inventoryDb = sp.GetRequiredService<InventoryDbContext>();

        Category catMens = Category.Create("ملابس رجالية");
        Category catWomn = Category.Create("ملابس نسائية");
        Category catShoe = Category.Create("أحذية");
        Category catAcc = Category.Create("إكسسوارات");
        Category catPerf = Category.Create("عطور");
        catMens.ClearDomainEvents(); catWomn.ClearDomainEvents(); catShoe.ClearDomainEvents();
        catAcc.ClearDomainEvents(); catPerf.ClearDomainEvents();
        catalogDb.Categories.AddRange(catMens, catWomn, catShoe, catAcc, catPerf);
        await catalogDb.SaveChangesAsync();

        List<(Product product, decimal qty)> products =
        [
            CreateProduct(catalogDb, "ثوب رجالي أبيض",      "ثوب رجالي قطن 100%",              catMens.Id.Value, "RTL-001", "قطعة",    45m, 85m,   30),
            CreateProduct(catalogDb, "قميص رجالي كاجوال",   "قميص كاجوال بألوان متعددة",        catMens.Id.Value, "RTL-002", "قطعة",    30m, 55m,   50),
            CreateProduct(catalogDb, "بنطلون جينز",          "جينز أزرق قاطع كلاسيكي",          catMens.Id.Value, "RTL-003", "قطعة",    40m, 75m,   40),
            CreateProduct(catalogDb, "عباية سوداء",          "عباية راقية بتطريز دقيق",          catWomn.Id.Value, "RTL-010", "قطعة",    55m, 95m,   25),
            CreateProduct(catalogDb, "فستان كاجوال",         "فستان خفيف لإطلالة يومية",         catWomn.Id.Value, "RTL-011", "قطعة",    65m, 125m,  20),
            CreateProduct(catalogDb, "بلوزة أنيقة",          "بلوزة حريرية ناعمة",               catWomn.Id.Value, "RTL-012", "قطعة",    35m, 65m,   30),
            CreateProduct(catalogDb, "حذاء رياضي",           "حذاء رياضي مريح للجري",            catShoe.Id.Value, "RTL-020", "زوج",     85m, 150m,  20),
            CreateProduct(catalogDb, "حذاء رسمي رجالي",      "حذاء جلد رجالي كلاسيكي",          catShoe.Id.Value, "RTL-021", "زوج",    110m, 200m,  15),
            CreateProduct(catalogDb, "حقيبة يد نسائية",      "حقيبة جلد صناعي أنيقة",            catAcc.Id.Value,  "RTL-030", "قطعة",    90m, 180m,  15),
            CreateProduct(catalogDb, "ساعة يد رجالية",       "ساعة فضية كلاسيكية",               catAcc.Id.Value,  "RTL-031", "قطعة",   180m, 350m,  10),
            CreateProduct(catalogDb, "نظارات شمسية",         "نظارات UV400 بإطار أسود",           catAcc.Id.Value,  "RTL-032", "قطعة",    45m, 90m,   20),
            CreateProduct(catalogDb, "عطر رجالي فاخر",       "عطر أروماتيك 100 مل",              catPerf.Id.Value, "RTL-040", "زجاجة",  145m, 280m,  10),
            CreateProduct(catalogDb, "عطر نسائي ورود",       "عطر زهري أنثوي 100 مل",            catPerf.Id.Value, "RTL-041", "زجاجة",  130m, 250m,  10),
        ];

        await catalogDb.SaveChangesAsync();

        foreach ((Product product, decimal qty) in products)
        {
            ProductVariant variant = product.Variants.First();
            StockItem stock = StockItem.Create(variant.Id.Value, branchId, reorderPoint: 5, reorderQuantity: 20);
            stock.Receive(qty, "seed", "بيانات تجريبية أولية");
            stock.ClearDomainEvents();
            inventoryDb.StockItems.Add(stock);
        }
        await inventoryDb.SaveChangesAsync();

        logger.LogInformation("Seeded retail catalog ({Count} products)", products.Count);
    }

    private static async Task SeedHotelTenantAsync(
        IServiceProvider sp, Guid tenantId, Guid branchId, ILogger logger)
    {
        HotelDbContext db = sp.GetRequiredService<HotelDbContext>();

        (RoomType type, string number, int floor, int capacity, decimal rate, string desc)[] rooms =
        [
            (RoomType.Standard,     "101", 1, 2, 250m,  "غرفة قياسية مريحة بإطلالة على الحديقة"),
            (RoomType.Standard,     "102", 1, 2, 250m,  "غرفة قياسية مريحة بسرير مزدوج"),
            (RoomType.Standard,     "103", 1, 2, 250m,  "غرفة قياسية بسريرين منفصلين"),
            (RoomType.Deluxe,       "201", 2, 3, 450m,  "غرفة ديلوكس بإطلالة بانورامية"),
            (RoomType.Deluxe,       "202", 2, 3, 450m,  "غرفة ديلوكس فاخرة مع جاكوزي"),
            (RoomType.Suite,        "301", 3, 4, 800m,  "جناح فاخر بغرفة معيشة مستقلة"),
            (RoomType.Suite,        "302", 3, 4, 800m,  "جناح تنفيذي بإطلالة على المدينة"),
            (RoomType.Presidential, "401", 4, 6, 1800m, "الجناح الرئاسي — الطابق الكامل"),
        ];

        foreach ((RoomType type, string number, int floor, int capacity, decimal rate, string desc) in rooms)
        {
            ErrorOr.ErrorOr<Room> result = Room.Create(tenantId, branchId, type, number, floor, capacity, rate, "SAR", desc);
            if (!result.IsError)
            {
                result.Value.ClearDomainEvents();
                db.Rooms.Add(result.Value);
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} hotel rooms for tenant {TenantId}", rooms.Length, tenantId);
    }

    private static async Task SeedGamingTenantAsync(
        IServiceProvider sp, Guid tenantId, Guid branchId, ILogger logger)
    {
        GamingDbContext db = sp.GetRequiredService<GamingDbContext>();

        (StationType type, string name, decimal rate)[] stations =
        [
            (StationType.Console, "PlayStation 5 — طاولة 1",  30m),
            (StationType.Console, "PlayStation 5 — طاولة 2",  30m),
            (StationType.Console, "Xbox Series X — طاولة 3",  30m),
            (StationType.PC,      "PC Gaming — محطة 1",        25m),
            (StationType.PC,      "PC Gaming — محطة 2",        25m),
            (StationType.PC,      "PC Gaming — محطة 3",        25m),
            (StationType.VR,      "Meta Quest 3 — VR",         50m),
            (StationType.Arcade,  "ملاكمة VR — Arcade",        40m),
        ];

        foreach ((StationType type, string name, decimal rate) in stations)
        {
            ErrorOr.ErrorOr<GameStation> result = GameStation.Create(tenantId, branchId, type, name, rate, "SAR");
            if (!result.IsError)
            {
                db.GameStations.Add(result.Value);
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} gaming stations for tenant {TenantId}", stations.Length, tenantId);
    }

    private static Product CreateMenuItem(
        CatalogDbContext db,
        string name, string description,
        Guid categoryId, string sku, string variantName, decimal salePrice)
    {
        Product product = Product.Create(
            name, description,
            new NexusPOS.Catalog.Domain.ValueObjects.CategoryId(categoryId),
            ProductType.Standard, TaxClass.Standard, trackInventory: false);

        NexusPOS.Catalog.Domain.ValueObjects.Sku skuVo =
            NexusPOS.Catalog.Domain.ValueObjects.Sku.Create(sku).Value;
        NexusPOS.Catalog.Domain.ValueObjects.Money priceVo =
            NexusPOS.Catalog.Domain.ValueObjects.Money.Create(salePrice, "SAR").Value;

        product.AddVariant(skuVo, variantName, priceVo, priceVo, null);
        product.ClearDomainEvents();
        db.Products.Add(product);
        return product;
    }
}
