using System.Globalization;
using System.Text;

namespace NexusPOS.Zatca.Application.Services;

public static class ZatcaXmlService
{
    public static string GenerateInvoiceXml(
        string invoiceNumber,
        Guid invoiceUuid,
        DateTime invoiceDate,
        string sellerName,
        string sellerVatNumber,
        decimal subtotalAmount,
        decimal taxAmount,
        decimal totalAmount,
        string currency,
        string qrCodeBase64)
    {
        var sb = new StringBuilder();
        string dateStr = invoiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        string timeStr = invoiceDate.ToUniversalTime().ToString("HH:mm:ss", CultureInfo.InvariantCulture);
        string sub = subtotalAmount.ToString("F2", CultureInfo.InvariantCulture);
        string tax = taxAmount.ToString("F2", CultureInfo.InvariantCulture);
        string total = totalAmount.ToString("F2", CultureInfo.InvariantCulture);

        sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.Append("<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"");
        sb.Append(" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\"");
        sb.Append(" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\"");
        sb.Append(" xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\">");
        sb.Append("<cbc:ProfileID>reporting:1.0</cbc:ProfileID>");
        sb.Append($"<cbc:ID>{EscapeXml(invoiceNumber)}</cbc:ID>");
        sb.Append($"<cbc:UUID>{invoiceUuid:D}</cbc:UUID>");
        sb.Append($"<cbc:IssueDate>{dateStr}</cbc:IssueDate>");
        sb.Append($"<cbc:IssueTime>{timeStr}</cbc:IssueTime>");
        sb.Append("<cbc:InvoiceTypeCode name=\"0100000000000000000000000000000000000000000000000000000000000000\">388</cbc:InvoiceTypeCode>");
        sb.Append($"<cbc:DocumentCurrencyCode>{EscapeXml(currency)}</cbc:DocumentCurrencyCode>");
        sb.Append($"<cbc:TaxCurrencyCode>{EscapeXml(currency)}</cbc:TaxCurrencyCode>");
        sb.Append("<cac:AdditionalDocumentReference>");
        sb.Append("<cbc:ID>QR</cbc:ID>");
        sb.Append($"<cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode=\"text/plain\">{EscapeXml(qrCodeBase64)}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment>");
        sb.Append("</cac:AdditionalDocumentReference>");
        sb.Append("<cac:AccountingSupplierParty><cac:Party>");
        sb.Append($"<cac:PartyName><cbc:Name>{EscapeXml(sellerName)}</cbc:Name></cac:PartyName>");
        sb.Append("<cac:PostalAddress>");
        sb.Append("<cbc:StreetName>N/A</cbc:StreetName>");
        sb.Append("<cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>");
        sb.Append("</cac:PostalAddress>");
        sb.Append("<cac:PartyTaxScheme>");
        sb.Append($"<cbc:CompanyID>{EscapeXml(sellerVatNumber)}</cbc:CompanyID>");
        sb.Append("<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>");
        sb.Append("</cac:PartyTaxScheme>");
        sb.Append($"<cac:PartyLegalEntity><cbc:RegistrationName>{EscapeXml(sellerName)}</cbc:RegistrationName></cac:PartyLegalEntity>");
        sb.Append("</cac:Party></cac:AccountingSupplierParty>");
        sb.Append("<cac:AccountingCustomerParty><cac:Party>");
        sb.Append("<cac:PostalAddress>");
        sb.Append("<cbc:StreetName>N/A</cbc:StreetName>");
        sb.Append("<cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>");
        sb.Append("</cac:PostalAddress>");
        sb.Append("</cac:Party></cac:AccountingCustomerParty>");
        sb.Append("<cac:TaxTotal>");
        sb.Append($"<cbc:TaxAmount currencyID=\"{EscapeXml(currency)}\">{tax}</cbc:TaxAmount>");
        sb.Append("<cac:TaxSubtotal>");
        sb.Append($"<cbc:TaxableAmount currencyID=\"{EscapeXml(currency)}\">{sub}</cbc:TaxableAmount>");
        sb.Append($"<cbc:TaxAmount currencyID=\"{EscapeXml(currency)}\">{tax}</cbc:TaxAmount>");
        sb.Append("<cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>15.00</cbc:Percent>");
        sb.Append("<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>");
        sb.Append("</cac:TaxSubtotal></cac:TaxTotal>");
        sb.Append("<cac:LegalMonetaryTotal>");
        sb.Append($"<cbc:LineExtensionAmount currencyID=\"{EscapeXml(currency)}\">{sub}</cbc:LineExtensionAmount>");
        sb.Append($"<cbc:TaxExclusiveAmount currencyID=\"{EscapeXml(currency)}\">{sub}</cbc:TaxExclusiveAmount>");
        sb.Append($"<cbc:TaxInclusiveAmount currencyID=\"{EscapeXml(currency)}\">{total}</cbc:TaxInclusiveAmount>");
        sb.Append($"<cbc:PayableAmount currencyID=\"{EscapeXml(currency)}\">{total}</cbc:PayableAmount>");
        sb.Append("</cac:LegalMonetaryTotal>");
        sb.Append("<cac:InvoiceLine>");
        sb.Append("<cbc:ID>1</cbc:ID>");
        sb.Append("<cbc:InvoicedQuantity unitCode=\"PCE\">1</cbc:InvoicedQuantity>");
        sb.Append($"<cbc:LineExtensionAmount currencyID=\"{EscapeXml(currency)}\">{sub}</cbc:LineExtensionAmount>");
        sb.Append("<cac:Item><cbc:Name>مبيعات</cbc:Name>");
        sb.Append("<cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>15.00</cbc:Percent>");
        sb.Append("<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>");
        sb.Append("</cac:Item>");
        sb.Append($"<cac:Price><cbc:PriceAmount currencyID=\"{EscapeXml(currency)}\">{sub}</cbc:PriceAmount></cac:Price>");
        sb.Append("</cac:InvoiceLine>");
        sb.Append("</Invoice>");

        return sb.ToString();
    }

    private static string EscapeXml(string value) =>
        value
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;")
            .Replace("'", "&apos;");
}
