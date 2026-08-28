(function () {
  'use strict';

  // =================================================================
  // 0. ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ И ИНСТРУМЕНТЫ
  // =================================================================

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalizeText(str) {
    if (!str) return '';
    return String(str).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function parseTargetText(val) {
    if (typeof val === 'string') return val.trim();
    if (val && typeof val === 'object' && val.text) return val.text.trim();
    return '';
  }

  function resolveTarget(val) {
    if (typeof val === 'string') return val.trim();
    if (val && typeof val === 'object') return val.target || val.text || val.value || '';
    return String(val || '').trim();
  }

  // Залочивание скролла во время автокликов
  const ScrollLock = {
    lock() {
      document.body.style.overflow = 'hidden';
    },
    unlock() {
      document.body.style.overflow = '';
    }
  };

  // Оверлей отладки на странице подачи объявления
  class DebugUI {
    constructor() {
      this.container = document.createElement('div');
      this.container.style.cssText = `
        position: fixed; top: 10px; right: 10px; width: 350px; max-height: 80vh;
        background: rgba(40, 42, 54, 0.95); color: #f8f8f2; font-family: monospace;
        font-size: 11px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        z-index: 999999; display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid #6272a4;
      `;

      this.header = document.createElement('div');
      this.header.style.cssText = `
        padding: 8px 12px; background: #44475a; font-weight: bold;
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid #6272a4;
      `;
      this.header.innerHTML = `<span>🚀 AutoClicker Debug</span><span id="ac-status" style="padding: 2px 6px; border-radius: 4px; background: #6272a4;">INIT</span>`;
      this.container.appendChild(this.header);

      this.logArea = document.createElement('div');
      this.logArea.style.cssText = `
        padding: 10px; overflow-y: auto; flex-grow: 1; display: flex;
        flex-direction: column; gap: 4px; max-height: 300px;
      `;
      this.container.appendChild(this.logArea);

      document.body.appendChild(this.container);
    }

    setStatus(text, color = '#6272a4') {
      const statusEl = this.container.querySelector('#ac-status');
      if (statusEl) {
        statusEl.textContent = text;
        statusEl.style.background = color;
        statusEl.style.color = '#fff';
      }
    }

    setFields(fields) {
      this.log(`Загружено полей: ${fields.length}`, '#bd93f9');
    }

    log(msg, color = '#f8f8f2') {
      const item = document.createElement('div');
      item.style.color = color;
      item.style.wordBreak = 'break-word';
      item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      this.logArea.appendChild(item);
      this.logArea.scrollTop = this.logArea.scrollHeight;
    }
  }

  // Эмуляция полного клика мыши по элементу DOM
  async function triggerFullClick(element) {
    if (!element) return;
    element.scrollIntoView({ block: 'center', behavior: 'instant' });

    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach((eventType) => {
      element.dispatchEvent(new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    });
  }

  // Ожидание появления элемента/состояния в DOM
  async function waitForFieldReady(predicate, timeout = 2000, step = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const res = predicate();
      if (res) return res;
      await sleep(step);
    }
    return null;
  }

  async function safeResetDropdownState() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(100);
  }

  // Заглушка получения внешнего реестра (маршрутов categories/steps)
  async function fetchTableData() {
    try {
      return { route: [], fields: [] };
    } catch (e) {
      return { route: [], fields: [] };
    }
  }

  // Автоматическое заполнение найденного поля формы
  async function fillFormField(field) {
    try {
      const targetNorm = normalizeText(field.targetValue);

      // 1. Поиск радио-кнопок или текстовых кнопок выбора
      const radioBtn = Array.from(document.querySelectorAll('label, button, div[role="radio"]'))
        .find(el => normalizeText(el.innerText || el.textContent) === targetNorm);

      if (radioBtn) {
        await triggerFullClick(radioBtn);
        return true;
      }

      // 2. Поиск инпутов / выпадающих списков
      const inputs = Array.from(document.querySelectorAll('input, select'));
      for (const input of inputs) {
        const placeholder = normalizeText(input.placeholder || '');
        const ariaLabel = normalizeText(input.getAttribute('aria-label') || '');
        const fieldNameNorm = normalizeText(field.name);

        if (placeholder.includes(fieldNameNorm) || ariaLabel.includes(fieldNameNorm)) {
          input.focus();
          input.value = field.targetValue;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(100);
          return true;
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  }


  // =================================================================
  // 1. ТОЧКА ВХОДА №1: CATALOGS.AVITO.RU (Точный оригинал изначальной логики)
  // =================================================================
  if (window.location.hostname.includes('catalogs.avito.ru')) {

    function getSelectedCatalog() {
      const titleEl = document.querySelector('[class*="title-root-"]') || document.querySelector('h1');
      return titleEl ? titleEl.textContent.trim() : '';
    }

    function parseCatalogFields() {
      const fields = [];
      const labels = document.querySelectorAll('[class*="grid-item-label-"]');
      
      labels.forEach(labelEl => {
        const parent = labelEl.parentElement;
        if (!parent) return;
        const valEl = parent.querySelector('[class*="grid-item-value-"]');
        if (labelEl && valEl) {
          const name = labelEl.textContent.trim();
          const value = valEl.textContent.trim();
          if (name && value) {
            fields.push({ name, value, type: 'text' });
          }
        }
      });

      return fields;
    }

    async function handleStartButtonClick() {
      const selectedCatalog = getSelectedCatalog();
      const extractedFields = parseCatalogFields();

      if (!selectedCatalog) {
        alert('Не удалось определить текущую категорию!');
        return;
      }

      const payload = {
        autoclick_active: true,
        selected_catalog: selectedCatalog,
        extracted_fields: JSON.stringify(extractedFields)
      };

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set(payload);
      }
      localStorage.setItem('ac_autoclick_active', 'true');
      localStorage.setItem('ac_selected_catalog', selectedCatalog);
      localStorage.setItem('ac_extracted_fields', JSON.stringify(extractedFields));

      window.location.href = 'https://www.avito.ru/additem';
    }

    function injectAutoclickButton() {
      if (document.getElementById('ac-start-btn')) return;

      const targetContainer = document.querySelector('[class*="desktop-controls-"]');
      if (!targetContainer) return;

      const btn = document.createElement('button');
      btn.id = 'ac-start-btn';
      btn.className = 'button-button-21p5n button-size-m-155W2 button-primary-3QWv5';
      btn.type = 'button';
      btn.style.marginLeft = '10px';
      btn.innerHTML = '<span class="button-content-35f9k">⚡ Автоклик</span>';

      btn.addEventListener('click', handleStartButtonClick);
      targetContainer.appendChild(btn);
    }

    const observer = new MutationObserver(() => {
      injectAutoclickButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    injectAutoclickButton();
  }


  // =================================================================
  // 2. ТОЧКА ВХОДА №2: WWW.AVITO.RU/ADDITEM (Исполнительный скрипт)
  // =================================================================
  if (window.location.hostname.includes('avito.ru') && window.location.pathname.includes('/additem')) {

    async function checkIsActive() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get(['autoclick_active']);
        if (res.autoclick_active) return true;
      }
      return localStorage.getItem('ac_autoclick_active') === 'true';
    }

    async function runPipeline() {
      const active = await checkIsActive();
      if (!active) return;

      ScrollLock.lock();
      let ui = null;

      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ autoclick_active: false });
        }
        localStorage.removeItem('ac_autoclick_active');

        let selectedCatalog = null;
        let extractedFieldsRaw = '[]';

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const store = await chrome.storage.local.get(['selected_catalog', 'extracted_fields']);
          selectedCatalog = store.selected_catalog;
          extractedFieldsRaw = store.extracted_fields || '[]';
        }

        if (!selectedCatalog) {
          selectedCatalog = localStorage.getItem('ac_selected_catalog');
          extractedFieldsRaw = localStorage.getItem('ac_extracted_fields') || '[]';
        }

        let extractedFields = [];
        try { extractedFields = JSON.parse(extractedFieldsRaw); } catch (e) { extractedFields = []; }

        if (!selectedCatalog) return;

        ui = new DebugUI();
        ui.setStatus('ЗАПУСК', '#ffcc00');
        ui.setFields(extractedFields);
        ui.log(`Кликер запущен для категории: "${selectedCatalog}"`);

        await safeResetDropdownState();

        const anotherCategoryBtn = await waitForFieldReady(() => {
          const btn = document.querySelector('button[data-marker="another-category"]');
          if (btn) return btn;
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(b => b.innerText && normalizeText(b.innerText).includes('другая категория'));
        }, 1200);

        if (anotherCategoryBtn) {
          await triggerFullClick(anotherCategoryBtn);
          ui.log('Клик "Другая категория"', '#50fa7b');
          await sleep(200);
        }

        ui.setStatus('ЗАГРУЗКА', '#00aaff');
        let responseData;
        try {
          responseData = await fetchTableData();
          ui.log('Реестр категорий загружен', '#50fa7b');
        } catch (err) {
          ui.setStatus('ОШИБКА СЕТИ', '#ff5555');
          ui.log(`❌ Ошибка загрузки данных: ${err}`, '#ff5555');
          return;
        }

        const routeData = responseData.route || responseData;
        const targetCatalogNorm = normalizeText(selectedCatalog);

        let routeRow = Array.isArray(routeData) ? routeData.find(r => {
          const cat = normalizeText(parseTargetText(r.Catalog || r.catalog));
          return cat && (targetCatalogNorm.includes(cat) || cat.includes(targetCatalogNorm));
        }) : null;

        if (!routeRow) {
          ui.setStatus('НЕ НАЙДЕНО', '#ff5555');
          ui.log(`❌ Категория "${selectedCatalog}" не найдена в реестре!`, '#ff5555');
          return;
        }

        const getSuggestValue = (val) => String(val || '').trim().toUpperCase() === 'TRUE';
        const chain = [];

        if (routeRow.category) {
          chain.push({ name: 'category', value: resolveTarget(routeRow.category) });
        }

        const stepKeys = Object.keys(routeRow)
          .filter(key => /^step\d+$/i.test(key))
          .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));

        for (let i = 0; i < stepKeys.length; i++) {
          const currentStepKey = stepKeys[i];
          const stepNum = currentStepKey.replace(/\D/g, '');
          const suggestKey = `suggest${stepNum}`;

          if (getSuggestValue(routeRow[suggestKey])) {
            const prevStep = chain[chain.length - 1];
            if (prevStep) {
              chain.push({ name: suggestKey, value: prevStep.value, isSuggest: true });
            }
          }

          if (routeRow[currentStepKey]) {
            chain.push({ name: currentStepKey, value: resolveTarget(routeRow[currentStepKey]), isSuggest: false });
          }
        }

        for (let step of chain) {
          const targetNorm = normalizeText(step.value);
          ui.setStatus(`КЛИК ${step.name.toUpperCase()}`, '#00aaff');

          if (step.isSuggest) {
            ui.log(`Поиск подсказки (${step.name}): "${step.value}"...`);
            const suggestElement = await waitForFieldReady(() => {
              const spans = Array.from(document.querySelectorAll('span[style*="var(--theme-semantics-text-secondary)"]'));
              return spans.find(el => normalizeText(el.innerText || el.textContent) === targetNorm);
            }, 2000);

            if (suggestElement) {
              await triggerFullClick(suggestElement);
              ui.log(`Выбрана подсказка (${step.name}): "${step.value}"`, '#50fa7b');
              await sleep(200);
            } else {
              ui.log(`⚠️ Не найдена подсказка (${step.name}) для: "${step.value}"`, '#ffb86c');
            }
          } else {
            ui.log(`Поиск категории: "${step.value}"...`);
            const element = await waitForFieldReady(() => {
              const buttons = Array.from(document.querySelectorAll('[data-marker="category-wizard/button"]'));
              return buttons.find(el => normalizeText(el.innerText || el.textContent) === targetNorm);
            }, 2000);

            if (element) {
              await triggerFullClick(element);
              ui.log(`Выбрано: "${step.value}"`, '#50fa7b');
              await sleep(200);
            } else {
              ui.log(`⚠️ Пропущен шаг ${step.name}: элемент "${step.value}" не найден`, '#ffb86c');
            }
          }
        }

        ui.setStatus('ПОДГОТОВКА ПОЛЕЙ', '#00aaff');
        ui.log('--- КАТЕГОРИИ ВЫБРАНЫ, ПЕРЕХОД К ПОЛЯМ ---', '#00aaff');

        if (extractedFields.length > 0) {
          ui.log(`Запуск заполнения полей (всего: ${extractedFields.length})`);
          ui.setStatus('ЗАПОЛНЕНИЕ ПОЛЕЙ', '#00aaff');

          for (let i = 0; i < extractedFields.length; i++) {
            const field = extractedFields[i];
            let cleanVal = parseTargetText(field.value);
            let isUsingDefault = false;

            if (!cleanVal && field.default_value) {
              cleanVal = parseTargetText(field.default_value) || String(field.default_value).trim();
              isUsingDefault = true;
            }

            if (!cleanVal) {
              ui.log(`⚠️ [${i + 1}/${extractedFields.length}] Пропущено поле "${field.name}" (нет значения)`, '#ffb86c');
              continue;
            }

            const logTag = isUsingDefault ? ' [DEFAULT]' : '';
            ui.log(`👉 [${i + 1}/${extractedFields.length}] Поле "${field.name}" (${field.type})${logTag} ➔ "${cleanVal}"`, '#f1fa8c');

            if (i > 0) await sleep(150);

            const fieldToFill = {
              ...field,
              targetValue: cleanVal,
              isDefaultUsed: isUsingDefault
            };

            const success = await fillFormField(fieldToFill);

            if (success) {
              ui.log(`✅ [${i + 1}/${extractedFields.length}] Готово: "${field.name}"`, '#50fa7b');
              if (isUsingDefault || field.name.toLowerCase().includes('тип') || field.name.toLowerCase().includes('марк')) {
                ui.log(`⏳ Ожидание появления зависимых полей...`, '#00aaff');
                await sleep(800);
              }
            } else {
              ui.log(`❌ [${i + 1}/${extractedFields.length}] Не удалось заполнить: ${field.name}`, '#ff5555');
            }
            await sleep(100);
          }
        } else {
          ui.log(`⚠️ Массив полей пуст!`, '#ffb86c');
        }

        ui.setStatus('УСПЕШНО', '#50fa7b');
        ui.log('Все операции завершены! 🎉', '#50fa7b');
      } finally {
        ScrollLock.unlock();
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runPipeline);
    } else {
      runPipeline();
    }
  }
})();
