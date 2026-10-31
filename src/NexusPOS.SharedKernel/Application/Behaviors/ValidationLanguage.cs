using System.Globalization;
using System.Reflection;
using FluentValidation;

namespace NexusPOS.SharedKernel.Application.Behaviors;

// Rules without WithMessage fall back to FluentValidation's built-in text, which is English unless
// the culture is set. The UI is Arabic-first, so the defaults are Arabic regardless of the server locale,
// and the common field names read in Arabic too ("'السعر' ..." rather than "'Unit Price' ...").
public static class ValidationLanguage
{
    public static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("ar");

    private static readonly Dictionary<string, string> _fieldNames = new(StringComparer.Ordinal)
    {
        ["Name"] = "الاسم",
        ["NameAr"] = "الاسم بالعربية",
        ["NameEn"] = "الاسم بالإنجليزية",
        ["FirstName"] = "الاسم الأول",
        ["LastName"] = "اسم العائلة",
        ["Email"] = "البريد الإلكتروني",
        ["Password"] = "كلمة المرور",
        ["CurrentPassword"] = "كلمة المرور الحالية",
        ["NewPassword"] = "كلمة المرور الجديدة",
        ["Phone"] = "رقم الجوال",
        ["PhoneNumber"] = "رقم الجوال",
        ["Address"] = "العنوان",
        ["Currency"] = "العملة",
        ["TimeZone"] = "المنطقة الزمنية",
        ["Description"] = "الوصف",
        ["Notes"] = "الملاحظات",
        ["Note"] = "الملاحظة",
        ["Reason"] = "السبب",
        ["Code"] = "الكود",
        ["Sku"] = "رمز SKU",
        ["Barcode"] = "الباركود",
        ["Quantity"] = "الكمية",
        ["Price"] = "السعر",
        ["UnitPrice"] = "سعر الوحدة",
        ["SalePrice"] = "سعر البيع",
        ["CostPrice"] = "سعر التكلفة",
        ["UnitCost"] = "تكلفة الوحدة",
        ["Amount"] = "المبلغ",
        ["AmountTendered"] = "المبلغ المدفوع",
        ["TaxRate"] = "نسبة الضريبة",
        ["TaxId"] = "الرقم الضريبي",
        ["VatRegistrationNumber"] = "الرقم الضريبي",
        ["DiscountValue"] = "قيمة الخصم",
        ["Points"] = "النقاط",
        ["Lines"] = "البنود",
        ["Items"] = "الأصناف",
        ["Type"] = "النوع",
        ["Status"] = "الحالة",
        ["SortOrder"] = "الترتيب",
        ["StartDate"] = "تاريخ البداية",
        ["EndDate"] = "تاريخ النهاية",
        ["ExpiryDate"] = "تاريخ الانتهاء",
        ["Reference"] = "المرجع",
        ["PostalCode"] = "الرمز البريدي",
        ["Country"] = "الدولة",
        ["Subdomain"] = "النطاق الفرعي",
        ["BranchId"] = "الفرع",
        ["TenantId"] = "المنشأة",
        ["CustomerId"] = "العميل",
        ["SupplierId"] = "المورد",
        ["CategoryId"] = "التصنيف",
        ["VariantId"] = "الصنف",
        ["ProductId"] = "المنتج",
        ["OrderId"] = "الطلب",
        ["RoomId"] = "الغرفة",
        ["StationId"] = "الجهاز",
        ["TableNumber"] = "رقم الطاولة",
        ["GuestName"] = "اسم الضيف",
        ["GuestPhone"] = "جوال الضيف",
        ["PaymentMethod"] = "طريقة الدفع",
        ["ReorderLevel"] = "حد إعادة الطلب",
        ["ReorderPoint"] = "حد إعادة الطلب",
        ["ReorderQuantity"] = "كمية إعادة الطلب",
        ["MinLevel"] = "الحد الأدنى",
        ["MaxLevel"] = "الحد الأعلى",
        ["VariantName"] = "اسم الخيار",
        ["ProductName"] = "اسم المنتج",
        ["ItemName"] = "اسم الصنف",
        ["StorageUnit"] = "وحدة التخزين",
        ["ComponentUnit"] = "وحدة المكوّن",
        ["ConversionFactor"] = "معامل التحويل",
        ["ContactPhone"] = "جوال التواصل",
        ["ContactEmail"] = "بريد التواصل",
        ["AdminEmail"] = "بريد المسؤول",
        ["DurationMinutes"] = "المدة بالدقائق",
        ["ExtraMinutes"] = "الدقائق الإضافية",
        ["HourlyRate"] = "سعر الساعة",
        ["RatePerHour"] = "سعر الساعة",
        ["NightlyRate"] = "سعر الليلة",
        ["RatePerNight"] = "سعر الليلة",
        ["PlayerName"] = "اسم اللاعب",
        ["RoomNumber"] = "رقم الغرفة",
        ["Floor"] = "الطابق",
        ["Capacity"] = "السعة",
        ["CheckOut"] = "تاريخ المغادرة",
        ["GuestNationalId"] = "هوية الضيف",
        ["SupplierName"] = "اسم المورد",
        ["SupplierVatNumber"] = "الرقم الضريبي للمورد",
        ["InvoiceNumber"] = "رقم الفاتورة",
        ["InvoiceDate"] = "تاريخ الفاتورة",
        ["BusinessType"] = "نوع النشاط",
        ["LegalEntityName"] = "الاسم القانوني",
        ["BranchCode"] = "كود الفرع",
        ["NewBranchCode"] = "كود الفرع",
        ["BranchDisplayName"] = "اسم الفرع",
        ["NewBranchDisplayName"] = "اسم الفرع",
        ["LogoUrl"] = "رابط الشعار",
        ["Role"] = "الدور",
        ["Value"] = "القيمة",
        ["TaxAmount"] = "مبلغ الضريبة",
        ["BaseAmount"] = "المبلغ الأساسي",
        ["MinOrderAmount"] = "الحد الأدنى للطلب",
        ["MaxUses"] = "عدد مرات الاستخدام",
        ["LoyaltyPoints"] = "نقاط الولاء",
        ["RedeemPoints"] = "نقاط الاستبدال",
        ["MinRedeemPoints"] = "الحد الأدنى للاستبدال",
        ["RedeemValue"] = "قيمة الاستبدال",
        ["PointsPerCurrencyUnit"] = "النقاط لكل ريال",
        ["NewQuantity"] = "الكمية الجديدة",
        ["SystemQuantity"] = "كمية النظام",
        ["InitialCost"] = "التكلفة الأولية",
        ["ManualCost"] = "التكلفة",
        ["PeriodStart"] = "بداية الفترة",
        ["PeriodEnd"] = "نهاية الفترة",
        ["EffectiveFrom"] = "تاريخ السريان",
    };

    // Used for any field not listed above, so a default message never carries English words.
    public const string GenericFieldName = "الحقل";

    public static void UseArabic()
    {
        ValidatorOptions.Global.LanguageManager.Culture = Culture;
        ValidatorOptions.Global.DisplayNameResolver = (_, member, _) => FieldName(member) ?? GenericFieldName;
    }

    // null when the field has no Arabic name; UseArabic then shows GenericFieldName.
    public static string? FieldName(MemberInfo? member) =>
        member is not null && _fieldNames.TryGetValue(member.Name, out string? name) ? name : null;
}
