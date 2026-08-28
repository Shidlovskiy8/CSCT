/**
 * Content Script: Add Item Automation Engine
 * Target Match: https://www.avito.ru/additem*
 */

(function () {
  'use strict';

  /**
   * Загрузка сохраненных данных из Chrome Storage API
   */
  function loadPipelineData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['autoclick_active', 'selected_catalog', 'extracted_fields'],
        (result) => {
          resolve({
            isActive: Boolean(result.autoclick_active),
            selectedCatalog: result.selected_catalog || null,
            extractedFields: result.extracted_fields || []
          });
        }
      );
    });
  }

  /**
   * Сброс флага активности в Хранилище
   */
  async function clearActiveFlag() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ autoclick_active: false }, resolve);
    });
  }

  /**
   * Главный пайплайн кликера и заполнения
   */
  async function runPipeline() {
    const { isActive, selectedCatalog, extractedFields } = await loadPipelineData();

    if (!isActive || !selectedCatalog) {
      return;
    }

    // Блокируем скролл во избежание сдвига полей пользователем
    if (typeof ScrollLock !== 'undefined' && ScrollLock.lock) {
      ScrollLock.lock();
    }

    let ui = null;

    try {
      // 1. Деактивируем повторный запуск
      await clearActiveFlag();

      // Инициализация отладочного интерфейса
      if (typeof DebugUI !== 'undefined') {
        ui = new DebugUI();
        ui.setStatus('ЗАПУСК', '#ffcc00');
        ui.setFields(extractedFields);
        ui.log(`Кликер запущен для: "${selectedCatalog}"`);
      }

      if (typeof safeResetDropdownState === 'function') {
        await safeResetDropdownState();
      }

      // 2. Поиск и клик по кнопке "Другая категория", если она есть
      const anotherCategoryBtn = await waitForFieldReady(() => {
        const btn = document.querySelector('button[data-marker="another-category"]');
        if (btn) return btn;
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => b.innerText && normalizeText(b.innerText).includes('другая категория'));
      }, 1200);

      if (anotherCategoryBtn) {
        await triggerFullClick(anotherCategoryBtn);
        if (ui) ui.log('Клик "Другая категория"', '#50fa7b');
        await sleep(200);
      }

      // 3. Загрузка Google Таблицы для построения Route
      if (ui) ui.setStatus('ЗАГРУЗКА', '#00aaff');
      let responseData;
      try {
        responseData = await fetchTableData();
        if (ui) ui.log('Таблица загружена', '#50fa7b');
      } catch (err) {
        if (ui) {
          ui.setStatus('ОШИБКА СЕТИ', '#ff5555');
          ui.log(`❌ Ошибка загрузки: ${err}`, '#ff5555');
        }
        return;
      }

      const routeData = responseData.route || responseData;
      const targetCatalogNorm = normalizeText(selectedCatalog);

      let routeRow = routeData.find(r => {
        const cat = normalizeText(parseTargetText(r.Catalog || r.catalog));
        return cat && (targetCatalogNorm.includes(cat) || cat.includes(targetCatalogNorm));
      });

      if (!routeRow) {
        if (ui) {
          ui.setStatus('НЕ НАЙДЕНО', '#ff5555');
          ui.log(`❌ Категория "${selectedCatalog}" не найдена в route!`, '#ff5555');
        }
        return;
      }

      // 4. Построение цепочки шагов (Category & Steps & Suggests)
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

      // 5. Выполнение кликов по цепочке категории
      for (let step of chain) {
        const targetNorm = normalizeText(step.value);
        if (ui) ui.setStatus(`КЛИК ${step.name.toUpperCase()}`, '#00aaff');

        if (step.isSuggest) {
          if (ui) ui.log(`Поиск подсказки (${step.name}): "${step.value}"...`);
          const suggestElement = await waitForFieldReady(() => {
            const spans = Array.from(document.querySelectorAll('span[style*="var(--theme-semantics-text-secondary)"]'));
            return spans.find(el => normalizeText(el.innerText || el.textContent) === targetNorm);
          }, 2000);

          if (suggestElement) {
            await triggerFullClick(suggestElement);
            if (ui) ui.log(`Выбрана подсказка (${step.name}): "${step.value}"`, '#50fa7b');
            await sleep(200);
          } else if (ui) {
            ui.log(`⚠️ Не найдена подсказка (${step.name}) для: "${step.value}"`, '#ffb86c');
          }
        } else {
          if (ui) ui.log(`Поиск категории: "${step.value}"...`);
          const element = await waitForFieldReady(() => {
            const buttons = Array.from(document.querySelectorAll('[data-marker="category-wizard/button"]'));
            return buttons.find(el => normalizeText(el.innerText || el.textContent) === targetNorm);
          }, 2000);

          if (element) {
            await triggerFullClick(element);
            if (ui) ui.log(`Выбрано: "${step.value}"`, '#50fa7b');
            await sleep(200);
          } else if (ui) {
            ui.log(`⚠️ Пропущен шаг ${step.name}: элемент "${step.value}" не найден`, '#ffb86c');
          }
        }
      }

      if (ui) {
        ui.setStatus('ПОДГОТОВКА ПОЛЕЙ', '#00aaff');
        ui.log('--- ROUTE ЗАВЕРШЕН, ПЕРЕХОД К ПОЛЯМ ---', '#00aaff');
      }

      // 6. Последовательное заполнение характеристик
      if (extractedFields.length > 0) {
        if (ui) {
          ui.log(`Запуск заполнения полей (всего: ${extractedFields.length})`);
          ui.setStatus('ЗАПОЛНЕНИЕ ПОЛЕЙ', '#00aaff');
        }

        for (let i = 0; i < extractedFields.length; i++) {
          const field = extractedFields[i];
          let cleanVal = parseTargetText(field.value);
          let isUsingDefault = false;

          if (!cleanVal && field.default_value) {
            cleanVal = parseTargetText(field.default_value) || String(field.default_value).trim();
            isUsingDefault = true;
          }

          if (!cleanVal) {
            if (ui) ui.log(`⚠️ [${i + 1}/${extractedFields.length}] Пропущено поле "${field.name}" (нет значения)`, '#ffb86c');
            continue;
          }

          const logTag = isUsingDefault ? ' [DEFAULT]' : '';
          if (ui) ui.log(`👉 [${i + 1}/${extractedFields.length}] Поле "${field.name}" (${field.type})${logTag} ➔ "${cleanVal}"`, '#f1fa8c');

          if (i > 0) await sleep(150);

          const fieldToFill = {
            ...field,
            targetValue: cleanVal,
            isDefaultUsed: isUsingDefault
          };

          const success = await fillFormField(fieldToFill);

          if (success) {
            if (ui) ui.log(`✅ [${i + 1}/${extractedFields.length}] Готово: "${field.name}"`, '#50fa7b');
            
            // Если поле может вызывать подгрузку зависимых полей (марка/модель/тип) — ждем
            const nameLower = field.name.toLowerCase();
            if (isUsingDefault || nameLower.includes('тип') || nameLower.includes('марк') || nameLower.includes('модель')) {
              if (ui) ui.log(`⏳ Ожидание появления зависимых полей...`, '#00aaff');
              await sleep(800);
            }
          } else if (ui) {
            ui.log(`❌ [${i + 1}/${extractedFields.length}] Не удалось заполнить: ${field.name}`, '#ff5555');
          }
          await sleep(100);
        }
      } else if (ui) {
        ui.log(`⚠️ Массив полей пуст!`, '#ffb86c');
      }

      if (ui) {
        ui.setStatus('УСПЕШНО', '#50fa7b');
        ui.log('Все операции завершены! 🎉', '#50fa7b');
      }
    } finally {
      if (typeof ScrollLock !== 'undefined' && ScrollLock.unlock) {
        ScrollLock.unlock();
      }
    }
  }

  // Запуск при готовности DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runPipeline);
  } else {
    runPipeline();
  }
})();
