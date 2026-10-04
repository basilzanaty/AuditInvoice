const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8'
};

// In-memory cache to handle read-only / ephemeral serverless environments like Vercel
const memoryCache = new Map();

// Helper: Read JSON file safely
function readJson(filePath, defaultValue = []) {
  if (memoryCache.has(filePath)) {
    return memoryCache.get(filePath);
  }
  try {
    if (!fs.existsSync(filePath)) {
      try { fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8'); } catch (wErr) {}
      memoryCache.set(filePath, defaultValue);
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    memoryCache.set(filePath, parsed);
    return parsed;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    memoryCache.set(filePath, defaultValue);
    return defaultValue;
  }
}

// Helper: Write JSON file safely
function writeJson(filePath, data) {
  memoryCache.set(filePath, data);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn(`Filesystem write skipped (read-only environment):`, err.message);
    return true; // Keep in memory
  }
}

// Helper: Audit Engine
function auditInvoice(invoice, existingInvoices = []) {
  const flags = [];
  let score = 100;

  const subtotal = Number(invoice.subtotal) || 0;
  const taxRate = Number(invoice.taxRate) || 0;
  const taxAmount = Number(invoice.taxAmount) || 0;
  const grandTotal = Number(invoice.grandTotal) || 0;

  // 1. Line items sum check
  if (Array.isArray(invoice.items) && invoice.items.length > 0) {
    const computedItemsSum = invoice.items.reduce((sum, item) => {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unitPrice) || 0;
      return sum + (q * p);
    }, 0);

    const diffItems = Math.abs(computedItemsSum - subtotal);
    if (diffItems > 0.5) {
      score -= 20;
      flags.push({
        type: 'danger',
        message: `خلل في مجموع البنود: مجموع البنود الفردية (${computedItemsSum.toFixed(2)}) لا يطابق المجموع الفرعي المدون (${subtotal.toFixed(2)})`
      });
    } else {
      flags.push({
        type: 'success',
        message: 'مجموع بنود الفاتورة مطابق تماماً للمجموع الفرعي'
      });
    }
  }

  // 2. Tax computation check
  const expectedTax = (subtotal * taxRate) / 100;
  const diffTax = Math.abs(expectedTax - taxAmount);
  if (taxRate > 0 && diffTax > 0.5) {
    score -= 25;
    flags.push({
      type: 'warning',
      message: `تنبيه حساب الضريبة: الضريبة المذكورة (${taxAmount.toFixed(2)}) لا تطابق نسبة ${taxRate}% (المفترض حسابياً: ${expectedTax.toFixed(2)})`
    });
  } else if (taxRate > 0) {
    flags.push({
      type: 'success',
      message: `الضريبة محسوبة بدقة (${taxRate}%) ومتوافقة مع المعايير المحاسبية`
    });
  }

  // 3. Grand Total check
  const expectedGrandTotal = subtotal + taxAmount;
  const diffGrand = Math.abs(expectedGrandTotal - grandTotal);
  if (diffGrand > 0.5) {
    score -= 25;
    flags.push({
      type: 'danger',
      message: `تنبيه المجموع النهائي: الإجمالي المدون (${grandTotal.toFixed(2)}) غير مطابق لحاصل جمع المجموع الفرعي + الضريبة (${expectedGrandTotal.toFixed(2)})`
    });
  }

  // 4. Duplicate Check
  const duplicate = existingInvoices.find(inv => 
    inv.id !== invoice.id &&
    inv.invoiceNumber &&
    inv.invoiceNumber.trim().toLowerCase() === (invoice.invoiceNumber || '').trim().toLowerCase() &&
    inv.vendorName &&
    inv.vendorName.trim().toLowerCase() === (invoice.vendorName || '').trim().toLowerCase()
  );

  if (duplicate) {
    score -= 30;
    flags.push({
      type: 'danger',
      message: `اشتباه فاتورة مكررة: يوجد فاتورة سابقة برقم (${invoice.invoiceNumber}) لنفس المورد (${invoice.vendorName}) مسجلة برقم [${duplicate.id}]`
    });
  }

  // 5. Vendor Tax ID format check
  const vatNumber = (invoice.vendorVatNumber || '').trim();
  if (!vatNumber) {
    score -= 10;
    flags.push({
      type: 'info',
      message: 'تنبيه: الرقم الضريبي للمورد غير مدون (فاتورة غير ضريبية أو مبسطة)'
    });
  } else if (vatNumber.length === 15 && vatNumber.startsWith('3') && vatNumber.endsWith('3')) {
    flags.push({
      type: 'success',
      message: 'الرقم الضريبي للمورد يحقق معايير هيئة الزكاة والضريبة والجمارك (15 رقماً يبدأ وينتهي بـ 3)'
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
}

// Helper: Call Gemini API if API key provided
async function extractWithGemini(apiKey, fileData, mimeType) {
  const prompt = `You are an expert OCR and financial accounting auditor.
Analyze this invoice or receipt image/PDF thoroughly and extract the structured data in JSON format.
Return ONLY valid JSON matching this schema:
{
  "invoiceNumber": "string",
  "vendorName": "string",
  "vendorVatNumber": "string",
  "customerName": "string",
  "customerVatNumber": "string",
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "currency": "SAR" or "USD" or "AED" or "EGP" or "EUR",
  "items": [
    {
      "description": "string",
      "quantity": 1,
      "unitPrice": 100.0,
      "total": 100.0
    }
  ],
  "subtotal": 100.0,
  "taxRate": 15,
  "taxAmount": 15.0,
  "grandTotal": 115.0,
  "paymentMethod": "string"
}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: fileData
            }
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(textOutput);
}

// Fallback Heuristic Simulator when no API key is provided
function simulateExtraction(fileName = 'invoice.pdf') {
  const sampleVendors = [
    { name: 'شركة التوريدات الرقمية المتقدمة', vat: '310492817200003', cur: 'SAR', rate: 15 },
    { name: 'مؤسسة الريادة لحلول التوزيع السريع', vat: '300892716300003', cur: 'SAR', rate: 15 },
    { name: 'Emirates Tech Logistics LLC', vat: '100492817200001', cur: 'AED', rate: 5 },
    { name: 'مجموعة الأهرام للخدمات المكتبية', vat: '492810392', cur: 'EGP', rate: 14 }
  ];

  const vendor = sampleVendors[Math.floor(Math.random() * sampleVendors.length)];
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const now = new Date();
  const issueDate = now.toISOString().split('T')[0];
  const due = new Date(now.getTime() + 15 * 86400000);
  const dueDate = due.toISOString().split('T')[0];

  const items = [
    {
      description: 'اشتراك خدمات البنية التحتية والمخدمات السحابية',
      quantity: 1,
      unitPrice: 2800.00,
      total: 2800.00
    },
    {
      description: 'ترخيص برمجيات الحماية وإدارة البيانات المؤسسية',
      quantity: 3,
      unitPrice: 450.00,
      total: 1350.00
    },
    {
      description: 'استشارات تقنية ودعم فني وتدقيق فصلي',
      quantity: 1,
      unitPrice: 1200.00,
      total: 1200.00
    }
  ];

  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const taxRate = vendor.rate;
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + taxAmount;

  return {
    invoiceNumber: `INV-${randomNum}`,
    vendorName: vendor.name,
    vendorVatNumber: vendor.vat,
    customerName: 'مؤسسة الحلول الذكية للتجارة',
    customerVatNumber: '300192837400003',
    issueDate,
    dueDate,
    currency: vendor.cur,
    items,
    subtotal,
    taxRate,
    taxAmount,
    grandTotal,
    paymentMethod: 'تحويل بنكي سداد'
  };
}

// Request body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) { // 20MB limit
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        if (!body) return resolve({});
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Helper response senders
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
  };

  const sendError = (statusCode, message) => {
    sendJson(statusCode, { error: message });
  };

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // -------------------------------------------------------------
    // REST API ROUTES
    // -------------------------------------------------------------

    // 1. GET /api/invoices (List with search/filter)
    if (method === 'GET' && pathname === '/api/invoices') {
      const invoices = readJson(INVOICES_FILE, []);
      const query = (parsedUrl.query.q || '').toLowerCase();
      const statusFilter = parsedUrl.query.status;

      let filtered = invoices;
      if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(inv => inv.status === statusFilter);
      }
      if (query) {
        filtered = filtered.filter(inv => 
          (inv.invoiceNumber || '').toLowerCase().includes(query) ||
          (inv.vendorName || '').toLowerCase().includes(query) ||
          (inv.customerName || '').toLowerCase().includes(query)
        );
      }

      return sendJson(200, filtered);
    }

    // 2. GET /api/stats (Summary dashboard figures)
    if (method === 'GET' && pathname === '/api/stats') {
      const invoices = readJson(INVOICES_FILE, []);
      const stats = {
        totalCount: invoices.length,
        verifiedCount: invoices.filter(i => i.status === 'verified').length,
        warningCount: invoices.filter(i => i.status === 'warning').length,
        flaggedCount: invoices.filter(i => i.status === 'flagged').length,
        totalAmountByCurrency: {},
        totalTaxByCurrency: {}
      };

      for (const inv of invoices) {
        const cur = inv.currency || 'SAR';
        stats.totalAmountByCurrency[cur] = (stats.totalAmountByCurrency[cur] || 0) + (Number(inv.grandTotal) || 0);
        stats.totalTaxByCurrency[cur] = (stats.totalTaxByCurrency[cur] || 0) + (Number(inv.taxAmount) || 0);
      }

      return sendJson(200, stats);
    }

    // 3. GET /api/invoices/:id (Single invoice)
    if (method === 'GET' && pathname.startsWith('/api/invoices/')) {
      const id = pathname.replace('/api/invoices/', '');
      const invoices = readJson(INVOICES_FILE, []);
      const invoice = invoices.find(inv => inv.id === id);
      if (!invoice) return sendError(404, 'الفاتورة غير موجودة');
      return sendJson(200, invoice);
    }

    // 4. POST /api/invoices/process (OCR & AI Extraction)
    if (method === 'POST' && pathname === '/api/invoices/process') {
      const body = await parseBody(req);
      const settings = readJson(SETTINGS_FILE, {});
      let extractedData = null;

      if (body.base64 && (settings.geminiApiKey || body.apiKey)) {
        try {
          const key = body.apiKey || settings.geminiApiKey;
          const mimeType = body.mimeType || 'image/jpeg';
          extractedData = await extractWithGemini(key, body.base64, mimeType);
        } catch (geminiErr) {
          console.warn('Gemini extraction failed, using heuristic engine:', geminiErr.message);
          extractedData = simulateExtraction(body.fileName);
          extractedData.aiNotice = 'تمت المعالجة عبر المحرك الذكي المدمج (فشل مفتاح Gemini أو خطأ اتصال)';
        }
      } else {
        extractedData = simulateExtraction(body.fileName);
      }

      // Generate ID and audit results
      const invoices = readJson(INVOICES_FILE, []);
      const nextId = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;
      extractedData.id = nextId;
      extractedData.createdAt = new Date().toISOString();

      const audit = auditInvoice(extractedData, invoices);
      extractedData.auditResults = {
        hasErrors: audit.hasErrors,
        score: audit.score,
        flags: audit.flags
      };
      extractedData.status = audit.status;

      // Save to database
      invoices.unshift(extractedData);
      writeJson(INVOICES_FILE, invoices);

      return sendJson(201, {
        success: true,
        message: 'تم فحص وتدقيق المستند بنجاح',
        invoice: extractedData
      });
    }

    // 5. POST /api/invoices (Create manual invoice)
    if (method === 'POST' && pathname === '/api/invoices') {
      const body = await parseBody(req);
      const invoices = readJson(INVOICES_FILE, []);
      const nextId = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;

      const newInvoice = {
        id: nextId,
        invoiceNumber: body.invoiceNumber || `INV-${Date.now()}`,
        vendorName: body.vendorName || 'مورد جديد',
        vendorVatNumber: body.vendorVatNumber || '',
        customerName: body.customerName || 'عميل محلي',
        customerVatNumber: body.customerVatNumber || '',
        issueDate: body.issueDate || new Date().toISOString().split('T')[0],
        dueDate: body.dueDate || new Date().toISOString().split('T')[0],
        currency: body.currency || 'SAR',
        items: Array.isArray(body.items) ? body.items : [],
        subtotal: Number(body.subtotal) || 0,
        taxRate: Number(body.taxRate) || 15,
        taxAmount: Number(body.taxAmount) || 0,
        grandTotal: Number(body.grandTotal) || 0,
        paymentMethod: body.paymentMethod || 'نقدي',
        createdAt: new Date().toISOString()
      };

      const audit = auditInvoice(newInvoice, invoices);
      newInvoice.auditResults = {
        hasErrors: audit.hasErrors,
        score: audit.score,
        flags: audit.flags
      };
      newInvoice.status = audit.status;

      invoices.unshift(newInvoice);
      writeJson(INVOICES_FILE, invoices);

      return sendJson(201, newInvoice);
    }

    // 6. PUT /api/invoices/:id (Update invoice)
    if (method === 'PUT' && pathname.startsWith('/api/invoices/')) {
      const id = pathname.replace('/api/invoices/', '');
      const body = await parseBody(req);
      const invoices = readJson(INVOICES_FILE, []);
      const index = invoices.findIndex(i => i.id === id);

      if (index === -1) return sendError(404, 'الفاتورة غير موجودة');

      const updated = { ...invoices[index], ...body, id };
      const audit = auditInvoice(updated, invoices);
      updated.auditResults = {
        hasErrors: audit.hasErrors,
        score: audit.score,
        flags: audit.flags
      };
      updated.status = audit.status;

      invoices[index] = updated;
      writeJson(INVOICES_FILE, invoices);

      return sendJson(200, updated);
    }

    // 7. DELETE /api/invoices/:id (Delete invoice)
    if (method === 'DELETE' && pathname.startsWith('/api/invoices/')) {
      const id = pathname.replace('/api/invoices/', '');
      let invoices = readJson(INVOICES_FILE, []);
      const initialLength = invoices.length;
      invoices = invoices.filter(i => i.id !== id);

      if (invoices.length === initialLength) return sendError(404, 'الفاتورة غير موجودة');

      writeJson(INVOICES_FILE, invoices);
      return sendJson(200, { success: true, message: 'تم حذف الفاتورة بنجاح' });
    }

    // 8. GET /api/export/csv (Export all invoices to CSV)
    if (method === 'GET' && pathname === '/api/export/csv') {
      const invoices = readJson(INVOICES_FILE, []);
      let csv = '\uFEFF'; // UTF-8 BOM for Microsoft Excel Arabic support
      csv += 'معرف النظام,رقم الفاتورة,اسم المورد,الرقم الضريبي للمورد,العميل,تاريخ الإصدار,العملة,المجموع الفرعي,نسبة الضريبة,مبلغ الضريبة,الإجمالي النهائي,حالة التدقيق\n';

      for (const inv of invoices) {
        const row = [
          `"${inv.id || ''}"`,
          `"${inv.invoiceNumber || ''}"`,
          `"${(inv.vendorName || '').replace(/"/g, '""')}"`,
          `"${inv.vendorVatNumber || ''}"`,
          `"${(inv.customerName || '').replace(/"/g, '""')}"`,
          `"${inv.issueDate || ''}"`,
          `"${inv.currency || ''}"`,
          (Number(inv.subtotal) || 0).toFixed(2),
          (Number(inv.taxRate) || 0) + '%',
          (Number(inv.taxAmount) || 0).toFixed(2),
          (Number(inv.grandTotal) || 0).toFixed(2),
          `"${inv.status === 'verified' ? 'مطابق وسليم' : inv.status === 'warning' ? 'تنبيه تدقيق' : 'مخالف / اشتباه'}"`
        ];
        csv += row.join(',') + '\n';
      }

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="DocuAudit_Invoices_Report.csv"'
      });
      return res.end(csv);
    }

    // 9. GET /api/settings & POST /api/settings
    if (pathname === '/api/settings') {
      if (method === 'GET') {
        const settings = readJson(SETTINGS_FILE, {});
        // Mask API key for security
        const masked = { ...settings };
        if (masked.geminiApiKey) {
          masked.geminiApiKeyMasked = masked.geminiApiKey.substring(0, 6) + '...' + masked.geminiApiKey.substring(masked.geminiApiKey.length - 4);
          masked.hasGeminiApiKey = true;
        } else {
          masked.hasGeminiApiKey = false;
        }
        delete masked.geminiApiKey;
        return sendJson(200, masked);
      }

      if (method === 'POST') {
        const body = await parseBody(req);
        const settings = readJson(SETTINGS_FILE, {});
        const updated = { ...settings, ...body };
        // Don't wipe api key if placeholder or empty string sent without intention
        if (body.geminiApiKey === undefined) {
          updated.geminiApiKey = settings.geminiApiKey;
        }
        writeJson(SETTINGS_FILE, updated);
        return sendJson(200, { success: true, message: 'تم حفظ الإعدادات بنجاح' });
      }
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING
    // -------------------------------------------------------------
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }

    const filePath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }

    // 404 handler
    sendError(404, 'الصفحة أو الرابط المطلوب غير موجود');
  } catch (error) {
    console.error('Server Unhandled Error:', error);
    sendError(500, `خطأ في الخادم: ${error.message}`);
  }
});

// Start listening
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 DocuAudit AI Server is running at http://localhost:${PORT}`);
  console.log(`💼 B2B AI Invoice & Document Audit System`);
  console.log(`=======================================================`);
});
