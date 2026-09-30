// Client-side Audit & Recalculation Engine
window.AuditEngine = {
  calculate: function(invoiceData, existingInvoices = []) {
    const subtotal = Number(invoiceData.subtotal) || 0;
    const taxRate = Number(invoiceData.taxRate) || 0;
    const taxAmount = Number(invoiceData.taxAmount) || 0;
    const grandTotal = Number(invoiceData.grandTotal) || 0;

    const flags = [];
    let score = 100;

    // 1. Line items check
    if (Array.isArray(invoiceData.items) && invoiceData.items.length > 0) {
      const itemsSum = invoiceData.items.reduce((s, it) => {
        const q = Number(it.quantity) || 1;
        const p = Number(it.unitPrice) || 0;
        return s + (q * p);
      }, 0);

      const diff = Math.abs(itemsSum - subtotal);
      if (diff > 0.5) {
        score -= 20;
        flags.push({
          type: 'danger',
          message: `خلل في مجموع البنود: مجموع البنود (${itemsSum.toFixed(2)}) لا يساوي المجموع الفرعي (${subtotal.toFixed(2)})`
        });
      } else {
        flags.push({
          type: 'success',
          message: 'مجموع بنود الفاتورة مطابق تماماً للمجموع الفرعي'
        });
      }
    }

    // 2. Tax check
    const expectedTax = (subtotal * taxRate) / 100;
    const diffTax = Math.abs(expectedTax - taxAmount);
    if (taxRate > 0 && diffTax > 0.5) {
      score -= 25;
      flags.push({
        type: 'warning',
        message: `تنبيه الضريبة: القيمة المسجلة (${taxAmount.toFixed(2)}) تختلف عن المحسوبة (${expectedTax.toFixed(2)}) بنسبة ${taxRate}%`
      });
    } else if (taxRate > 0) {
      flags.push({
        type: 'success',
        message: `نسبة الضريبة (${taxRate}%) ومبلغ الضريبة (${taxAmount.toFixed(2)}) متطابقان محاسبياً`
      });
    }

    // 3. Grand total check
    const expectedGrandTotal = subtotal + taxAmount;
    const diffGrand = Math.abs(expectedGrandTotal - grandTotal);
    if (diffGrand > 0.5) {
      score -= 25;
      flags.push({
        type: 'danger',
        message: `خطأ في الإجمالي: المفترض (${expectedGrandTotal.toFixed(2)}) والمسجل بالفاتورة (${grandTotal.toFixed(2)})`
      });
    }

    // 4. Duplicate check
    const duplicate = existingInvoices.find(inv => 
      inv.id !== invoiceData.id &&
      inv.invoiceNumber &&
      inv.invoiceNumber.trim().toLowerCase() === (invoiceData.invoiceNumber || '').trim().toLowerCase() &&
      inv.vendorName &&
      inv.vendorName.trim().toLowerCase() === (invoiceData.vendorName || '').trim().toLowerCase()
    );

    if (duplicate) {
      score -= 30;
      flags.push({
        type: 'danger',
        message: `تحذير تكرار: توجد فاتورة سابقة لنفس المورد ورقم الفاتورة مسجلة مسبقاً`
      });
    }

    // 5. Vendor Tax ID format check
    const vatNum = (invoiceData.vendorVatNumber || '').trim();
    if (!vatNum) {
      flags.push({
        type: 'info',
        message: 'ملاحظة: لا يوجد رقم ضريبي مسجل للمورد (فاتورة مبسطة أو غير خاضعة)'
      });
    } else if (vatNum.length === 15 && vatNum.startsWith('3') && vatNum.endsWith('3')) {
      flags.push({
        type: 'success',
        message: 'الرقم الضريبي يحقق المعايير النظامية لهيئة الزكاة والضريبة'
      });
    }

    score = Math.max(0, Math.min(100, score));
    let status = 'verified';
    if (score < 70) {
      status = 'flagged';
    } else if (score < 90) {
      status = 'warning';
    }

    return {
      hasErrors: score < 90,
      score,
      flags,
      status
    };
  },

  formatCurrency: function(amount, currency = 'SAR') {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num) + ' ' + currency;
  }
};
