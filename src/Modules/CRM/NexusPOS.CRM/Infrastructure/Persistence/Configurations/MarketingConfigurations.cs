using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.CRM.Domain.Marketing;

namespace NexusPOS.CRM.Infrastructure.Persistence.Configurations;

internal sealed class MarketingCampaignConfiguration : IEntityTypeConfiguration<MarketingCampaign>
{
    public void Configure(EntityTypeBuilder<MarketingCampaign> builder)
    {
        builder.ToTable("marketing_campaigns");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id");
        builder.Property(c => c.TenantId).HasColumnName("tenant_id");
        builder.Property(c => c.Message).HasColumnName("message").HasMaxLength(MarketingCampaign.MaxMessageLength);
        builder.Property(c => c.ImageId).HasColumnName("image_id");
        builder.Property(c => c.Channel).HasColumnName("channel");
        builder.Property(c => c.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(c => c.CreatedAt).HasColumnName("created_at");
        builder.Property(c => c.WhatsAppMediaId).HasColumnName("whatsapp_media_id").HasMaxLength(128);
        builder.HasMany(c => c.Recipients).WithOne().HasForeignKey(r => r.CampaignId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(c => c.Recipients).HasField("_recipients").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(c => new { c.TenantId, c.CreatedAt }).HasDatabaseName("ix_marketing_campaigns_tenant_created");
    }
}

internal sealed class CampaignRecipientConfiguration : IEntityTypeConfiguration<CampaignRecipient>
{
    public void Configure(EntityTypeBuilder<CampaignRecipient> builder)
    {
        builder.ToTable("marketing_campaign_recipients");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.CampaignId).HasColumnName("campaign_id");
        builder.Property(r => r.CustomerId).HasColumnName("customer_id");
        builder.Property(r => r.Name).HasColumnName("name").HasMaxLength(256);
        builder.Property(r => r.Phone).HasColumnName("phone").HasMaxLength(32);
        builder.Property(r => r.Status).HasColumnName("status");
        builder.Property(r => r.Error).HasColumnName("error").HasMaxLength(300);
        builder.Property(r => r.ProviderMessageId).HasColumnName("provider_message_id").HasMaxLength(128);
        builder.Property(r => r.SentAt).HasColumnName("sent_at");
    }
}

// Lives in the shared schema on purpose: the public image link carries no tenant, only the random id.
internal sealed class MarketingMediaConfiguration : IEntityTypeConfiguration<MarketingMedia>
{
    public void Configure(EntityTypeBuilder<MarketingMedia> builder)
    {
        builder.ToTable("marketing_media", "public");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id");
        builder.Property(m => m.TenantId).HasColumnName("tenant_id");
        builder.Property(m => m.ContentType).HasColumnName("content_type").HasMaxLength(32);
        builder.Property(m => m.Data).HasColumnName("data");
        builder.Property(m => m.CreatedAt).HasColumnName("created_at");
    }
}

internal sealed class WhatsAppSettingsConfiguration : IEntityTypeConfiguration<WhatsAppSettings>
{
    public void Configure(EntityTypeBuilder<WhatsAppSettings> builder)
    {
        builder.ToTable("whatsapp_settings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id");
        builder.Property(s => s.PhoneNumberId).HasColumnName("phone_number_id").HasMaxLength(64);
        builder.Property(s => s.AccessToken).HasColumnName("access_token").HasMaxLength(1024);
        builder.Property(s => s.TemplateName).HasColumnName("template_name").HasMaxLength(256);
        builder.Property(s => s.LanguageCode).HasColumnName("language_code").HasMaxLength(16);
        builder.Property(s => s.HasImageHeader).HasColumnName("has_image_header");
        builder.Property(s => s.IncludeNameVariable).HasColumnName("include_name_variable");
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at");
        builder.Ignore(s => s.IsConfigured);
        builder.Ignore(s => s.TokenHint);
        builder.HasIndex(s => s.TenantId).IsUnique().HasDatabaseName("ix_whatsapp_settings_tenant");
    }
}
