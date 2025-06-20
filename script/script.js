(() => {
    'use strict';

    // State: list of transactions
    let transactions = [];
    let pendingTransaction = null;

    // DOM refs
    const form = document.getElementById('entry-form');
    const entriesSection = document.getElementById('entries-section');
    const totalBalanceElem = document.getElementById('total-balance');
    const dateInput = form.querySelector('#date');
    const previewModal = document.getElementById('preview-modal');
    const previewContent = document.getElementById('preview-content');
    const previewCancelBtn = document.getElementById('preview-cancel');
    const previewConfirmBtn = document.getElementById('preview-confirm');

    // Set date input max and default to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;
    dateInput.min = today;

    // Format utilities
    const formatCurrency = (num) => {
      return num.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
    };
    const formatDateLong = (isoDateStr) => {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      const date = new Date(isoDateStr);
      return date.toLocaleDateString(undefined, options);
    };
    const formatTimeShort = (dateObj) => {
      return dateObj.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: false});
    };

    // Show preview modal
    function showPreview(data) {
      previewContent.innerHTML = '';
      
      // Create HTML for the preview
      const now = new Date();
      const previewHTML = `
        <div class="preview-row">
          <span class="preview-label">Type</span>
          <span class="preview-value ${data.type}">
            <span class="material-icons" aria-hidden="true" style="vertical-align: middle;">
              ${data.type === 'income' ? 'arrow_circle_up' : 'arrow_circle_down'}
            </span>
            ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}
          </span>
        </div>
        <div class="preview-row">
          <span class="preview-label">Amount</span>
          <span class="preview-value ${data.type}">
            ${data.type === 'income' ? '+' : '-'}${formatCurrency(parseFloat(data.amount))}
          </span>
        </div>
        <div class="preview-row">
          <span class="preview-label">Date</span>
          <span class="preview-value">${data.date}</span>
        </div>
        <div class="preview-row">
          <span class="preview-label">Time</span>
          <span class="preview-value">${formatTimeShort(now)}</span>
        </div>
        <div class="preview-row" style="grid-column: span 2">
          <span class="preview-label">Description</span>
          <span class="preview-value">${data.description || 'No description'}</span>
        </div>
      `;
      
      previewContent.innerHTML = previewHTML;
      previewModal.classList.add('active');
    }

    // Hide preview modal
    function hidePreview() {
      previewModal.classList.remove('active');
    }

    // Group transactions by date (YYYY-MM-DD)
    const groupTransactionsByDate = (txs) => {
      return txs.reduce((acc, tx) => {
        const dateKey = tx.date.split('T')[0];
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(tx);
        return acc;
      }, {});
    };

    // Group transactions by type inside each date group
    const groupTransactionsByDateAndType = (txs) => {
      const grouped = groupTransactionsByDate(txs);
      // For each date, create object with income and expense arrays
      for (const date in grouped) {
        const incomeTxs = grouped[date].filter(tx => tx.type === 'income');
        const expenseTxs = grouped[date].filter(tx => tx.type === 'expense');
        grouped[date] = { income: incomeTxs, expense: expenseTxs };
      }
      return grouped;
    };

    // Render entries grouped by date and nested by type
    function renderEntries() {
      entriesSection.innerHTML = '';

      if (!transactions.length) {
        entriesSection.innerHTML = '<p style="color: #6b7280; font-style: italic;">No transactions added yet.</p>';
        totalBalanceElem.textContent = formatCurrency(0);
        return;
      }

      // Sort transactions descending by date and time before grouping
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Group by date and type
      const grouped = groupTransactionsByDateAndType(transactions);

      // Calculate total balance
      const total = transactions.reduce((sum, tx) => {
        // Income positive add, expense subtract
        return tx.type === 'income' ? sum + tx.amount : sum - tx.amount;
      }, 0);
      totalBalanceElem.textContent = formatCurrency(total);

      // Sort dates descending
      const sortedDates = Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a));

      for (const date of sortedDates) {
        const groupDiv = document.createElement('section');
        groupDiv.className = 'date-group';
        groupDiv.setAttribute('aria-label', `Transactions for ${formatDateLong(date)}`);

        const header = document.createElement('h3');
        header.className = 'date-group-header';
        header.textContent = formatDateLong(date);
        groupDiv.appendChild(header);

        // Subgroups container
        // Income subgroup
        if (grouped[date].income.length) {
          const incomeSection = document.createElement('div');
          incomeSection.className = 'subgroup';
          const incomeHeader = document.createElement('h4');
          incomeHeader.className = 'subgroup-header';
          incomeHeader.innerHTML = '<span class="material-icons income" aria-hidden="true">arrow_circle_up</span> Income';
          incomeSection.appendChild(incomeHeader);

          const incomeList = document.createElement('div');
          incomeList.className = 'entry-list';

          // Sort by time ascending (earliest first)
          grouped[date].income.sort((a,b) => new Date(a.date) - new Date(b.date));

          for (const tx of grouped[date].income) {
            incomeList.appendChild(createEntryElement(tx));
          }
          incomeSection.appendChild(incomeList);
          groupDiv.appendChild(incomeSection);
        }

        // Expense subgroup
        if (grouped[date].expense.length) {
          const expenseSection = document.createElement('div');
          expenseSection.className = 'subgroup';
          const expenseHeader = document.createElement('h4');
          expenseHeader.className = 'subgroup-header';
          expenseHeader.innerHTML = '<span class="material-icons expense" aria-hidden="true">arrow_circle_down</span> Expense';
          expenseSection.appendChild(expenseHeader);

          const expenseList = document.createElement('div');
          expenseList.className = 'entry-list';

          // Sort by time ascending (earliest first)
          grouped[date].expense.sort((a,b) => new Date(a.date) - new Date(b.date));

          for (const tx of grouped[date].expense) {
            expenseList.appendChild(createEntryElement(tx));
          }
          expenseSection.appendChild(expenseList);
          groupDiv.appendChild(expenseSection);
        }

        entriesSection.appendChild(groupDiv);
      }
    }

    // Create a single entry DOM element
    function createEntryElement(tx) {
      const entry = document.createElement('article');
      entry.className = 'entry';
      if (tx.type === 'expense') {
        entry.classList.add('expense');
      }
      entry.setAttribute('tabindex', '0');
      entry.setAttribute('aria-label', `Transaction at ${formatTimeShort(new Date(tx.date))}, amount ${formatCurrency(tx.amount)}, description: ${tx.description || 'none'}`);

      // Time (with icon)
      const timeDiv = document.createElement('div');
      timeDiv.className = 'time';
      const timeIcon = document.createElement('span');
      timeIcon.className = 'material-icons';
      timeIcon.setAttribute('aria-hidden', 'true');
      timeIcon.textContent = 'schedule';
      timeDiv.appendChild(timeIcon);
      const timeText = document.createTextNode(formatTimeShort(new Date(tx.date)));
      timeDiv.appendChild(timeText);
      entry.appendChild(timeDiv);

      // Amount
      const amountDiv = document.createElement('div');
      amountDiv.className = 'amount';
      amountDiv.textContent = tx.type === 'income' ? formatCurrency(tx.amount) : '-' + formatCurrency(tx.amount);
      entry.appendChild(amountDiv);

      // Description
      const descDiv = document.createElement('div');
      descDiv.className = 'description';
      descDiv.textContent = tx.description || '–';
      entry.appendChild(descDiv);

      return entry;
    }

    // Create transaction object from form data
    function createTransaction(data) {
      const {amount, description, date, type} = data;
      if (!type) return null;

      const amtNumRaw = parseFloat(amount);
      if (isNaN(amtNumRaw) || amtNumRaw <= 0) return null;

      // Compose ISO string with date + current time
      const dateOnly = new Date(date);
      const now = new Date();

      // Use date from form, but time as now if date == today else 12:00 (midday)
      let isoString;
      const todayStr = new Date().toISOString().split('T')[0];
      if (date === todayStr) {
        // Use actual current time
        isoString = new Date().toISOString();
        // But overwrite just the date part with chosen date, keep the time
        // So swap date part only
        const timePart = isoString.split('T')[1];
        isoString = date + 'T' + timePart;
      } else {
        // Use midday ISO time for past or future dates
        isoString = date + 'T12:00:00.000Z';
      }

      return {
        id: crypto.randomUUID(),
        amount: amtNumRaw,
        description: description.trim(),
        date: isoString,
        type,
      };
    }

    // Add transaction to list
    function addTransaction(transaction) {
      if (!transaction) return;
      transactions.push(transaction);
      renderEntries();
    }

    // Form submit handler - now shows preview instead of adding directly
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        amount: formData.get('amount'),
        description: formData.get('description'),
        date: formData.get('date'),
        type: formData.get('type')
      };
      
      // Create and store the pending transaction
      pendingTransaction = createTransaction(data);
      
      if (pendingTransaction) {
        showPreview(data);
      }
    });

    // Preview confirm handler
    previewConfirmBtn.addEventListener('click', () => {
      if (pendingTransaction) {
        addTransaction(pendingTransaction);
        pendingTransaction = null;
        
        // Reset form
        form.reset();
        dateInput.value = today;
        form.querySelector('#type-income').checked = true;
        
        hidePreview();
      }
    });

    // Preview cancel handler
    previewCancelBtn.addEventListener('click', hidePreview);

    // Close modal when clicking outside content
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        hidePreview();
      }
    });

    // Prevent "e", "+", "-" in amount input
    const amountInput = form.querySelector('#amount');
    amountInput.addEventListener('keydown', function(e) {
      if (
        e.key === 'e' ||
        e.key === 'E' ||
        e.key === '+' ||
        e.key === '-'
      ) {
        e.preventDefault();
      }
    });

    // Accessibility helper: sr-only class
    const style = document.createElement('style');
    style.textContent = `.sr-only { 
      position: absolute !important; 
      width: 1px !important; 
      height: 1px !important; 
      padding: 0 !important; 
      margin: -1px !important; 
      overflow: hidden !important; 
      clip: rect(0,0,0,0) !important; 
      white-space: nowrap !important; 
      border: 0 !important;
    }`;
    document.head.appendChild(style);

    // Initial render empty
    renderEntries();
  })();