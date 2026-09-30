// DocuAudit AI - Main Application Controller
let state = {
  invoices: [],
  currentInvoice: null,
  currentFilter: 'all',
  settings: {},
  activeTab: 'dashboard'
};

// Initialization on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupDropzone();
  setupSampleButtons();
  loadSettings();
  loadInvoices();
  loadStats();
  calculateRoi();
});

// 1. Navigation & Tabs
function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });

  // Update tab sections
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.remove('active');
  });

  const activeContent = document.getElementById(`tab-${tabId}`);
  if (activeContent) {
    activeContent.classList.add('active');
  }

  // Refresh data if opening invoices or dashboard
  if (tabId === 'dashboard') {
    loadStats();
    loadInvoices();
  } else if (tabId === 'invoices') {
    loadInvoices();
  }
}

// 2. Load Invoices from Backend API
async function loadInvoices() {
  try {
    const res = await fetch('/api/invoices');
    if (!res.ok) throw new Error('فشل تحميل الفواتير');
    const data = await res.json();
    state.invoices = data;

    // Update badge count
    const badge = document.getElementById('invoicesBadgeCount');
    if (badge) badge.textContent = data.length;

    renderInvoicesTable();
    renderDashboardRecent();
  } catch (err) {
    console.error('Error loading invoices:', err);
    showToast('حدث خطأ أثناء تحميل الفواتير', 'danger');
  }
}

// 3. Load Stats & KPIs
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
    const stats = await res.json();

    document.getElementById('kpiTotalInvoices').textContent = stats.totalCount || 0;
    document.getElementById('kpiVerifiedInvoices').textContent = stats.verifiedCount || 0;
    document.getElementById('kpiFlaggedInvoices').textContent = (stats.warningCount || 0) + (stats.flaggedCount || 0);

    const sarTotal = stats.totalAmountByCurrency?.SAR || 0;
    document.getElementById('kpiTotalAmount').textContent = sarTotal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// 4. Render Tables
function renderDashboardRecent() {
  const tbody = document.getElementById('dashboardRecentInvoices');
  if (!tbody) return;

  const recent = state.invoices.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا توجد فواتير مفحوصة بعد. قم برفع أول فاتورة!</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(inv => `
    <tr>
      <td><strong>${inv.id}</strong></td>
      <td>${inv.invoiceNumber}</td>
      <td>${inv.vendorName}</td>
      <td>${inv.issueDate}</td>
      <td><strong>${(Number(inv.grandTotal) || 0).toLocaleString()} ${inv.currency}</strong></td>
      <td>${getStatusBadge(inv.status)}</td>
      <td>
        <button class="sample-btn" onclick="openInvoiceInInspector('${inv.id}')">فحص وتعديل 🔍</button>
      </td>
    </tr>
  `).join('');
}

function renderInvoicesTable() {
  const tbody = document.getElementById('invoicesTableBody');
  if (!tbody) return;

  let list = state.invoices;

  // Filter
  if (state.currentFilter !== 'all') {
    list = list.filter(inv => inv.status === state.currentFilter);
  }

  // Search
  const searchInput = document.getElementById('searchInput');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (q) {
    list = list.filter(inv => 
      (inv.invoiceNumber || '').toLowerCase().includes(q) ||
      (inv.vendorName || '').toLowerCase().includes(q) ||
      (inv.customerName || '').toLowerCase().includes(q)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">لا توجد نتائج مطابقة لبحثك.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(inv => `
    <tr>
      <td><strong>${inv.id}</strong></td>
      <td>${inv.invoiceNumber}</td>
      <td>${inv.vendorName}</td>
      <td style="font-family: monospace;">${inv.vendorVatNumber || '<span style="color:#94a3b8;">غير مسجل</span>'}</td>
      <td>${inv.issueDate}</td>
      <td>${(Number(inv.subtotal) || 0).toLocaleString()} ${inv.currency}</td>
      <td>${(Number(inv.taxAmount) || 0).toLocaleString()} (${inv.taxRate}%)</td>
      <td><strong>${(Number(inv.grandTotal) || 0).toLocaleString()} ${inv.currency}</strong></td>
      <td>${getStatusBadge(inv.status)}</td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          <button class="sample-btn" title="معاينة وتعديل" onclick="openInvoiceInInspector('${inv.id}')">🔍</button>
          <button class="sample-btn" style="color: var(--danger);" title="حذف" onclick="deleteInvoice('${inv.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getStatusBadge(status) {
  if (status === 'verified') {
    return `<span class="badge badge-success">✅ مطابق وسليم</span>`;
  } else if (status === 'warning') {
    return `<span class="badge badge-warning">⚠️ تنبيه محاسبي</span>`;
  } else {
    return `<span class="badge badge-danger">🚨 اشتباه / مخالفة</span>`;
  }
}

// 5. Filter & Search handlers
function applyFilter(filter) {
  state.currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === filter);
  });
  renderInvoicesTable();
}

function handleSearch() {
  renderInvoicesTable();
}

// 6. Dropzone & File Upload Setup
function setupDropzone() {
  const dropZone = document.getElementById('dropZone');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processSelectedFile(files[0]);
    }
  });
}

function triggerFileInput() {
  document.getElementById('fileInput').click();
}

function handleFileSelected(event) {
  const file = event.target.files[0];
  if (file) {
    processSelectedFile(file);
  }
}

function processSelectedFile(file) {
  const reader = new FileReader();
  reader.onload = async function() {
    const base64Data = reader.result.split(',')[1];
    startScanAnimation(file.name, async () => {
      try {
        const res = await fetch('/api/invoices/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            base64: base64Data
          })
        });

        if (!res.ok) throw new Error('فشل معالجة المستند');
        const data = await res.json();
        showToast('تم فحص المستند واستخراج البيانات بنجاح', 'success');
        state.currentInvoice = data.invoice;
        populateInspector(data.invoice);
        loadInvoices();
        loadStats();
      } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء معالجة المستند', 'danger');
      }
    });
  };
  reader.readAsDataURL(file);
}

// 7. Pre-loaded Sample Invoices Buttons
function setupSampleButtons() {
  const list = document.getElementById('sampleButtonsList');
  if (!list || !window.SAMPLE_INVOICES) return;

  list.innerHTML = window.SAMPLE_INVOICES.map((sample, idx) => `
    <button class="sample-btn" onclick="testSampleInvoice(${idx})">
      <span>📄</span>
      <span>${sample.name}</span>
      <span class="badge ${sample.badgeClass}" style="font-size: 0.72rem; padding: 0.15rem 0.45rem;">${sample.badge}</span>
    </button>
  `).join('');
}

function testSampleInvoice(idx) {
  const sample = window.SAMPLE_INVOICES[idx];
  if (!sample) return;

  startScanAnimation(sample.fileName, async () => {
    // Audit the sample against existing invoices
    const invoiceData = JSON.parse(JSON.stringify(sample.data));
    const nextId = `INV-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(3, '0')}`;
    invoiceData.id = nextId;
    invoiceData.createdAt = new Date().toISOString();

    const audit = window.AuditEngine.calculate(invoiceData, state.invoices);
    invoiceData.auditResults = {
      hasErrors: audit.hasErrors,
      score: audit.score,
      flags: audit.flags
    };
    invoiceData.status = audit.status;

    state.currentInvoice = invoiceData;
    populateInspector(invoiceData);
    showToast(`تم فحص نموذج: ${sample.name}`, 'success');
  });
}

// 8. Scanning Visualizer Animation
function startScanAnimation(fileName, onComplete) {
  const progressBox = document.getElementById('scanProgressBox');
  const inspector = document.getElementById('inspectorContainer');
  const bar = document.getElementById('progressBarFill');
  const statusText = document.getElementById('scanStatusText');

  progressBox.style.display = 'block';
  inspector.style.display = 'none';

  const steps = [
    { p: 25, stepId: 'step1', text: `جاري قراءة ملف: ${fileName}...` },
    { p: 55, stepId: 'step2', text: 'استخراج بنود المشتريات والمجاميع بدقة...' },
    { p: 80, stepId: 'step3', text: 'التحقق من صحة الرقم الضريبي ومطابقة نسبة الضريبة...' },
    { p: 100, stepId: 'step4', text: 'اكتمال التدقيق والفحص بنجاح!' }
  ];

  let current = 0;
  const interval = setInterval(() => {
    if (current < steps.length) {
      const step = steps[current];
      bar.style.width = step.p + '%';
      statusText.textContent = step.text;

      // Mark step active
      document.querySelectorAll('.step-item').forEach((item, i) => {
        if (i < current) {
          item.className = 'step-item completed';
        } else if (i === current) {
          item.className = 'step-item active';
        } else {
          item.className = 'step-item';
        }
      });

      current++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        progressBox.style.display = 'none';
        inspector.style.display = 'grid';
        if (typeof onComplete === 'function') onComplete();
      }, 400);
    }
  }, 450);
}

// 9. Populate Split Inspector & Form
function populateInspector(inv) {
  // Mock Preview
  document.getElementById('mockVendorName').textContent = inv.vendorName || '-';
  document.getElementById('mockVendorVat').textContent = 'الرقم الضريبي: ' + (inv.vendorVatNumber || 'غير متوفر');
  document.getElementById('mockInvoiceNumber').textContent = inv.invoiceNumber || '-';
  document.getElementById('mockCustomerName').textContent = inv.customerName || 'شركة عامة';
  document.getElementById('mockCustomerVat').textContent = inv.customerVatNumber || 'غير مسجل';
  document.getElementById('mockIssueDate').textContent = inv.issueDate || '-';
  document.getElementById('mockDueDate').textContent = inv.dueDate || '-';

  // Items
  const itemsBody = document.getElementById('mockItemsBody');
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    itemsBody.innerHTML = inv.items.map(it => `
      <tr>
        <td>${it.description}</td>
        <td>${it.quantity}</td>
        <td>${Number(it.unitPrice).toFixed(2)}</td>
        <td><strong>${Number(it.total).toFixed(2)}</strong></td>
      </tr>
    `).join('');
  } else {
    itemsBody.innerHTML = `
      <tr>
        <td>بند مشتريات / خدمات عامة</td>
        <td>1</td>
        <td>${Number(inv.subtotal).toFixed(2)}</td>
        <td><strong>${Number(inv.subtotal).toFixed(2)}</strong></td>
      </tr>
    `;
  }

  document.getElementById('mockSubtotal').textContent = `${Number(inv.subtotal).toFixed(2)} ${inv.currency}`;
  document.getElementById('mockTaxRate').textContent = inv.taxRate || 0;
  document.getElementById('mockTaxAmount').textContent = `${Number(inv.taxAmount).toFixed(2)} ${inv.currency}`;
  document.getElementById('mockGrandTotal').textContent = `${Number(inv.grandTotal).toFixed(2)} ${inv.currency}`;

  // Form Fields
  document.getElementById('editInvoiceNumber').value = inv.invoiceNumber || '';
  document.getElementById('editVendorName').value = inv.vendorName || '';
  document.getElementById('editVendorVat').value = inv.vendorVatNumber || '';
  document.getElementById('editCustomerName').value = inv.customerName || '';
  document.getElementById('editIssueDate').value = inv.issueDate || '';
  document.getElementById('editCurrency').value = inv.currency || 'SAR';
  document.getElementById('editSubtotal').value = inv.subtotal || 0;
  document.getElementById('editTaxRate').value = inv.taxRate || 15;
  document.getElementById('editTaxAmount').value = inv.taxAmount || 0;
  document.getElementById('editGrandTotal').value = inv.grandTotal || 0;

  renderAuditFlags(inv.auditResults);
}

function openInvoiceInInspector(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;

  state.currentInvoice = inv;
  switchTab('scanner');
  document.getElementById('scanProgressBox').style.display = 'none';
  document.getElementById('inspectorContainer').style.display = 'grid';
  populateInspector(inv);
}

// 10. Render Audit Flags
function renderAuditFlags(audit) {
  const flagsList = document.getElementById('auditFlagsList');
  const scoreBadge = document.getElementById('auditScoreBadge');
  if (!audit) return;

  scoreBadge.textContent = `نقاط التدقيق: ${audit.score || 100}%`;
  scoreBadge.className = (audit.score >= 90) ? 'badge badge-success' : (audit.score >= 70) ? 'badge badge-warning' : 'badge badge-danger';

  if (!audit.flags || audit.flags.length === 0) {
    flagsList.innerHTML = `<div class="flag-alert success">✅ لا توجد أي ملاحظات أو أخطاء حسابية. الفاتورة سليمة 100%</div>`;
    return;
  }

  flagsList.innerHTML = audit.flags.map(f => `
    <div class="flag-alert ${f.type}">
      <span>${f.type === 'success' ? '✅' : f.type === 'warning' ? '⚠️' : f.type === 'danger' ? '🚨' : 'ℹ️'}</span>
      <span>${f.message}</span>
    </div>
  `).join('');
}

// 11. Recalculate on Form Input
function recalculateInvoice() {
  const invoiceData = {
    id: state.currentInvoice ? state.currentInvoice.id : 'NEW',
    invoiceNumber: document.getElementById('editInvoiceNumber').value,
    vendorName: document.getElementById('editVendorName').value,
    vendorVatNumber: document.getElementById('editVendorVat').value,
    customerName: document.getElementById('editCustomerName').value,
    issueDate: document.getElementById('editIssueDate').value,
    currency: document.getElementById('editCurrency').value,
    subtotal: Number(document.getElementById('editSubtotal').value) || 0,
    taxRate: Number(document.getElementById('editTaxRate').value) || 0,
    taxAmount: Number(document.getElementById('editTaxAmount').value) || 0,
    grandTotal: Number(document.getElementById('editGrandTotal').value) || 0,
    items: state.currentInvoice ? state.currentInvoice.items : []
  };

  // Update preview numbers
  document.getElementById('mockVendorName').textContent = invoiceData.vendorName || '-';
  document.getElementById('mockVendorVat').textContent = 'الرقم الضريبي: ' + (invoiceData.vendorVatNumber || 'غير متوفر');
  document.getElementById('mockInvoiceNumber').textContent = invoiceData.invoiceNumber || '-';
  document.getElementById('mockSubtotal').textContent = `${invoiceData.subtotal.toFixed(2)} ${invoiceData.currency}`;
  document.getElementById('mockTaxRate').textContent = invoiceData.taxRate;
  document.getElementById('mockTaxAmount').textContent = `${invoiceData.taxAmount.toFixed(2)} ${invoiceData.currency}`;
  document.getElementById('mockGrandTotal').textContent = `${invoiceData.grandTotal.toFixed(2)} ${invoiceData.currency}`;

  // Audit
  const audit = window.AuditEngine.calculate(invoiceData, state.invoices);
  renderAuditFlags(audit);
}

// 12. Save Current Invoice (Create or Update)
async function saveCurrentInvoice(event) {
  event.preventDefault();

  const invoiceData = {
    invoiceNumber: document.getElementById('editInvoiceNumber').value,
    vendorName: document.getElementById('editVendorName').value,
    vendorVatNumber: document.getElementById('editVendorVat').value,
    customerName: document.getElementById('editCustomerName').value,
    issueDate: document.getElementById('editIssueDate').value,
    currency: document.getElementById('editCurrency').value,
    subtotal: Number(document.getElementById('editSubtotal').value) || 0,
    taxRate: Number(document.getElementById('editTaxRate').value) || 0,
    taxAmount: Number(document.getElementById('editTaxAmount').value) || 0,
    grandTotal: Number(document.getElementById('editGrandTotal').value) || 0,
    items: state.currentInvoice ? state.currentInvoice.items : []
  };

  try {
    const isExisting = state.currentInvoice && state.invoices.some(i => i.id === state.currentInvoice.id);
    const endpoint = isExisting ? `/api/invoices/${state.currentInvoice.id}` : '/api/invoices';
    const method = isExisting ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });

    if (!res.ok) throw new Error('فشل حفظ الفاتورة');
    const saved = await res.json();
    state.currentInvoice = saved;

    showToast('تم حفظ الفاتورة وتثبيتها بنجاح في السجل', 'success');
    loadInvoices();
    loadStats();
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء حفظ الفاتورة', 'danger');
  }
}

// 13. Delete Invoice
async function deleteInvoice(id) {
  if (!confirm(`هل أنت متأكد من رغبتك في حذف الفاتورة [${id}] نهائياً من الأرشيف؟`)) {
    return;
  }

  try {
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('فشل الحذف');
    showToast('تم حذف الفاتورة بنجاح', 'info');
    loadInvoices();
    loadStats();
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء الحذف', 'danger');
  }
}

// 14. Copy Accounting Entry
function copyAccountingEntry() {
  const inv = state.currentInvoice;
  if (!inv) return;

  const entryText = `[قيد محاسبي آلي - DocuAudit AI]
رقم الفاتورة: ${inv.invoiceNumber}
المورد: ${inv.vendorName}
---------------------------------------------
من حـ/ المصروفات أو المشتريات:  ${(Number(inv.subtotal) || 0).toFixed(2)} ${inv.currency}  (مدين)
من حـ/ ضريبة القيمة المضافة المستردة: ${(Number(inv.taxAmount) || 0).toFixed(2)} ${inv.currency}  (مدين)
إلى حـ/ الموردين (${inv.vendorName}): ${(Number(inv.grandTotal) || 0).toFixed(2)} ${inv.currency}  (دائن)
---------------------------------------------
حالة التدقيق: ${inv.status === 'verified' ? 'مطابق وسليم' : 'يوجد ملاحظات تدقيق'}
`;

  navigator.clipboard.writeText(entryText).then(() => {
    showToast('تم نسخ القيد المحاسبي بنجاح للحافظة!', 'success');
  }).catch(() => {
    showToast('تعذر نسخ القيد للحافظة', 'warning');
  });
}

// 15. Export CSV
function exportCsv() {
  window.location.href = '/api/export/csv';
  showToast('جاري تنزيل ملف الإكسل (CSV) المتوافق مع اللغة العربية...', 'info');
}

// 16. ROI Calculator
function calculateRoi() {
  const count = Number(document.getElementById('roiInvoicesCount')?.value) || 300;
  const rate = Number(document.getElementById('roiHourlyRate')?.value) || 15;

  // Assuming manual entry & verification takes ~12 minutes (0.2 hr) per invoice
  const hoursSaved = Math.round(count * 0.2);
  const moneySaved = Math.round(hoursSaved * rate);

  const savedMoneyEl = document.getElementById('roiSavedMoney');
  const savedHoursEl = document.getElementById('roiSavedHours');

  if (savedMoneyEl) savedMoneyEl.textContent = `$${moneySaved.toLocaleString()}`;
  if (savedHoursEl) savedHoursEl.textContent = `${hoursSaved} ساعة`;
}

// 17. Settings Management
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();
    state.settings = settings;

    if (document.getElementById('setCompanyName')) {
      document.getElementById('setCompanyName').value = settings.companyName || 'DocuAudit AI Hub';
      document.getElementById('setDefaultTaxRate').value = settings.defaultTaxRate || 15;
      document.getElementById('setDefaultCurrency').value = settings.currency || 'SAR';
      if (settings.hasGeminiApiKey) {
        document.getElementById('setGeminiApiKey').placeholder = `مسجل مسبقاً (${settings.geminiApiKeyMasked})`;
      }
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings(event) {
  event.preventDefault();

  const apiKeyVal = document.getElementById('setGeminiApiKey').value.trim();
  const payload = {
    companyName: document.getElementById('setCompanyName').value,
    defaultTaxRate: Number(document.getElementById('setDefaultTaxRate').value),
    currency: document.getElementById('setDefaultCurrency').value
  };

  if (apiKeyVal) {
    payload.geminiApiKey = apiKeyVal;
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('فشل حفظ الإعدادات');
    showToast('تم حفظ الإعدادات بنجاح', 'success');
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء حفظ الإعدادات', 'danger');
  }
}

// 18. Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'danger' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
