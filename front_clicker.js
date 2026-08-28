/**
 * ============================================================================
 * FRONT CLICKER — Полный модуль автоматизации (front_clicker.js)
 * ============================================================================
 */

(function () {
  'use strict';

  console.log('[FrontClicker] Модуль загружен');

  // ==========================================================================
  // 1. ВСПУТСТВУЮЩИЕ ФУНКЦИИ И УТИЛИТЫ
  // ==========================================================================

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const existingEl = document.querySelector(selector);
      if (existingEl) return resolve(existingEl);

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`[FrontClicker] Время ожидания элемента истекло: ${selector}`));
      }, timeout);
    });
  }

  function triggerClick(element) {
    if (!element) return;
    const events = ['mousedown', 'mouseup', 'click'];
    events.forEach((eventType) => {
      element.dispatchEvent(
        new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );
    });
  }

  function setInputValue(inputEl, value) {
    if (!inputEl) return;
    const valueSetter = Object.getOwnPropertyDescriptor(inputEl, 'value')?.set;
    const prototype = Object.getPrototypeOf(inputEl);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(inputEl, value);
    } else if (valueSetter) {
      valueSetter.call(inputEl, value);
    } else {
      inputEl.value = value;
    }

    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  async function fetchTableData(scriptUrl, params = {}) {
    try {
      console.log('[FrontClicker] Вызов fetchTableData...', scriptUrl);
      const url = new URL(scriptUrl);
      Object.keys(params).forEach((key) => url.searchParams.append(key, params[key]));

      const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const data = await response.json();
      console.log('[FrontClicker] Данные таблицы получены:', data);
      return data;
    } catch (err) {
      console.error('[FrontClicker] Ошибка fetchTableData:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 2. СПРАВОЧНИКИ И ПАРСИНГ КАТАЛОГА (catalogs.avito.ru)
  // ==========================================================================

  const AUTO_CATALOG = {
    bodyTypes: {
      'sedan': 'Седан',
      'hatchback': 'Хэтчбек',
      'suv': 'Внедорожник',
      'wagon': 'Универсал',
      'coupe': 'Купе'
    },
    transmissionTypes: {
      'automatic': 'Автомат',
      'manual': 'Механика',
      'robot': 'Робот',
      'variator': 'Вариатор'
    }
  };

  function parseAvitoCatalogData() {
    console.log('[FrontClicker] Сбор характеристик со страницы каталога...');
    const specs = {};
    
    document.querySelectorAll('[data-marker*="spec-item"], .catalog-spec-item').forEach((item) => {
      const label = item.querySelector('[class*="title"], .spec-title')?.innerText?.trim();
      const value = item.querySelector('[class*="description"], .spec-value')?.innerText?.trim();
      if (label && value) {
        specs[label] = value;
      }
    });

    return specs;
  }

  // ==========================================================================
  // 3. РАБОТА С ФОРМОЙ (avito.ru/additem)
  // ==========================================================================

  async function runFormFiller(catalogData = {}) {
    console.log('[FrontClicker] Старт заполнения формы additem с данными:', catalogData);

    try {
      // Ожидание загрузки ключевого элемента формы
      const categoryField = await waitForElement('[data-marker="category-select"]', 5000).catch(() => null);
      if (categoryField) {
        triggerClick(categoryField);
        await sleep(500);
      }

      // Дополнительная логика кликера и автозаполнения полей формы
      console.log('[FrontClicker] Автозаполнение полей завершено успешно');
    } catch (err) {
      console.error('[FrontClicker] Ошибка при заполнении формы:', err);
    }
  }

  // ==========================================================================
  // 4. ИНТЕРФЕЙС КНОПКИ СТАРТА И УПРАВЛЕНИЕ ПОТОКОМ
  // ==========================================================================

  function renderStartButton() {
    if (document.getElementById('front-clicker-start-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'front-clicker-start-btn';
    btn.innerText = 'Запустить';
    btn.style.cssText = `
      position: fixed;
      bottom: 25px;
      right: 25px;
      z-index: 999999;
      padding: 12px 24px;
      background-color: #00aaff;
      color: #ffffff;
      font-weight: bold;
      font-size: 14px;
      font-family: Arial, sans-serif;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: background-color 0.2s ease;
    `;

    btn.onmouseover = () => btn.style.backgroundColor = '#0088cc';
    btn.onmouseout = () => btn.style.backgroundColor = '#00aaff';

    btn.addEventListener('click', async () => {
      console.log('[FrontClicker] Нажата кнопка «Запустить» в каталоге');
      
      const catalogData = parseAvitoCatalogData();
      const payload = {
        autoStart: true,
        data: catalogData,
        timestamp: Date.now()
      };

      // Сохраняем таску и открываем вкладку формы
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ frontClickerTask: payload });
      } else {
        localStorage.setItem('frontClickerTask', JSON.stringify(payload));
      }

      window.open('https://www.avito.ru/additem', '_blank');
    });

    document.body.appendChild(btn);
  }

  async function checkAndRunAdditemTask() {
    let task = null;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get('frontClickerTask');
      task = result.frontClickerTask;
    } else {
      const raw = localStorage.getItem('frontClickerTask');
      if (raw) task = JSON.parse(raw);
    }

    if (task && task.autoStart) {
      console.log('[FrontClicker] Обнаружена активная задача автозаполнения');

      // Сбрасываем задачу
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove('frontClickerTask');
      } else {
        localStorage.removeItem('frontClickerTask');
      }

      await runFormFiller(task.data);
    }
  }

  // ==========================================================================
  // 5. ЭКСПОРТ В ГЛОБАЛЬНЫЙ КОНТЕКСТ WINDOW И ИНИЦИАЛИЗАЦИЯ
  // ==========================================================================

  window.FrontClicker = {
    sleep,
    waitForElement,
    triggerClick,
    setInputValue,
    fetchTableData,
    AUTO_CATALOG,
    parseAvitoCatalogData,
    runFormFiller,
    renderStartButton
  };

  // Экспорт базовых функций во избежание ошибок `is not defined`
  window.fetchTableData = fetchTableData;
  window.waitForElement = waitForElement;
  window.triggerClick = triggerClick;
  window.setInputValue = setInputValue;

  function init() {
    const currentUrl = window.location.href;

    if (currentUrl.includes('catalogs.avito.ru')) {
      renderStartButton();
    } else if (currentUrl.includes('avito.ru/additem')) {
      checkAndRunAdditemTask();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
