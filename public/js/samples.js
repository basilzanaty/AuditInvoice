// Pre-loaded realistic sample invoices for 1-click instant testing
window.SAMPLE_INVOICES = [
  {
    name: 'فاتورة ضريبية معتمدة (السعودية - 15%)',
    badge: 'مطابقة وسليمة 100%',
    badgeClass: 'badge-success',
    fileName: 'ZATCA_Tax_Invoice_AlOfoq.pdf',
    data: {
      invoiceNumber: 'SA-99482',
      vendorName: 'شركة التقنية المتقدمة للحلول السحابية',
      vendorVatNumber: '300892716300003',
      customerName: 'مؤسسة الرياض للأعمال والتجارة',
      customerVatNumber: '310928475600003',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: 'SAR',
      items: [
        { description: 'تجهيز خادم سحابي عالي الأداء مع نسخ احتياطي', quantity: 1, unitPrice: 3500.00, total: 3500.00 },
        { description: 'تراخيص بريد إلكتروني أعمال سنوية (15 مستخدم)', quantity: 15, unitPrice: 120.00, total: 1800.00 },
        { description: 'خدمات الحماية من الهجمات الإلكترونية والدعم', quantity: 1, unitPrice: 1200.00, total: 1200.00 }
      ],
      subtotal: 6500.00,
      taxRate: 15,
      taxAmount: 975.00,
      grandTotal: 7475.00,
      paymentMethod: 'تحويل بنكي - مصرف الراجحي'
    }
  },
  {
    name: 'فاتورة لوجستية (الإمارات - تنبيه خطأ ضريبي)',
    badge: 'تحتوي خطأ حسابي مكتشف',
    badgeClass: 'badge-warning',
    fileName: 'Dubai_Express_Freight_Invoice.pdf',
    data: {
      invoiceNumber: 'DXB-FRT-8821',
      vendorName: 'شركة دبي السريعة للشحن الدولي',
      vendorVatNumber: '100492817200001',
      customerName: 'مجموعة المشرق للتوزيع',
      customerVatNumber: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      currency: 'AED',
      items: [
        { description: 'شحن بحري - 2 حاوية تجارية من جبل علي', quantity: 2, unitPrice: 4800.00, total: 9600.00 },
        { description: 'رسوم تفريغ ومناولة جمركية', quantity: 1, unitPrice: 1400.00, total: 1400.00 }
      ],
      subtotal: 11000.00,
      taxRate: 5,
      taxAmount: 450.00, // Deliberate error (5% of 11000 is 550, not 450)
      grandTotal: 11450.00, // Deliberate error (should be 11550)
      paymentMethod: 'شيك مؤجل الدفع'
    }
  },
  {
    name: 'فاتورة تجهيزات مكتبية (مصر - 14%)',
    badge: 'معتمدة - ضريبة 14%',
    badgeClass: 'badge-success',
    fileName: 'Cairo_Office_Supplies_Egypt.pdf',
    data: {
      invoiceNumber: 'EG-INV-3049',
      vendorName: 'مؤسسة الأهرام للتجهيزات والحلول المكتبية',
      vendorVatNumber: '492817290',
      customerName: 'شركة كودمايند للبرمجيات',
      customerVatNumber: '581920391',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      currency: 'EGP',
      items: [
        { description: 'مكاتب عمل ذكية قابلة لتعديل الارتفاع', quantity: 4, unitPrice: 6500.00, total: 26000.00 },
        { description: 'وحدات إضاءة هندسية LED موفرة', quantity: 8, unitPrice: 450.00, total: 3600.00 }
      ],
      subtotal: 29600.00,
      taxRate: 14,
      taxAmount: 4144.00,
      grandTotal: 33744.00,
      paymentMethod: 'فودافون كاش / بطاقة بنكية'
    }
  },
  {
    name: 'فاتورة برمجيات دولية (تحذير اشتباه تكرار)',
    badge: 'اشتباه تكرار الفاتورة',
    badgeClass: 'badge-danger',
    fileName: 'CloudMetrics_USD_Invoice.pdf',
    data: {
      invoiceNumber: 'US-SaaS-10928', // Matches existing invoice in seed data!
      vendorName: 'CloudMetrics Platform Inc.',
      vendorVatNumber: 'US-EIN-94829104',
      customerName: 'Future Soft Enterprises',
      customerVatNumber: '300482910400003',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      currency: 'USD',
      items: [
        { description: 'Enterprise Analytics Monthly Subscription', quantity: 1, unitPrice: 499.00, total: 499.00 }
      ],
      subtotal: 499.00,
      taxRate: 0,
      taxAmount: 0.00,
      grandTotal: 499.00,
      paymentMethod: 'Credit Card (Stripe)'
    }
  }
];
