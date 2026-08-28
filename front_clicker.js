/**
 * ============================================================================
 * FRONT CLICKER — Единый модуль автоматизации Avito (front_clicker.js)
 * ============================================================================
 */

(function () {
  'ize_strict';

  console.log('[FrontClicker] Модуль успешно загружен в MAIN контексте');

  // ==========================================================================
  // 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И УТИЛИТЫ (ранее helpers.js)
  // ==========================================================================

  /**
   * Пауза / Задержка выполнения
   */
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Ожидание появления DOM-элемента на странице
   */
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
        reject(new Error(`[FrontClicker] Превышено время ожидания элемента: ${selector}`));
      }, timeout);
    });
  }

  /**
   * Симуляция естественного клика по элементу
   */
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

  /**
   * Заполнение инпута с генерацией всех необходимых событий React/Vue
   */
  function setInputValue(inputEl, value) {
    if (!inputEl) return;
    
    // Получаем native setter для React-компонентов
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

  /**
   * Запрос данных таблицы через Google Apps Script API или внутренний ендпоинт
   */
  async function fetchTableData(scriptUrl, params = {}) {
    try {
      console.log('[FrontClicker] Вызов fetchTableData...', scriptUrl);
      
      const url = new URL(scriptUrl);
      Object.keys(params).forEach((key) => url.searchParams.append(key, params[key]));

      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[FrontClicker] Данные таблицы успешно получены:', data);
      return data;
    } catch (err) {
      console.error('[FrontClicker] Ошибка при вызове fetchTableData:', err);
      throw err;
    }
  }


  // ==========================================================================
  // 2. СПРАВОЧНИКИ И КАТАЛОГИ (ранее catalogs.js)
  // ==========================================================================

  const AUTO_CATALOG = {
    // Сопоставление технических параметров и категорий Avito
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
    },
    engineTypes: {
      'gasoline': 'Бензин',
      'diesel': 'Дизель',
      'hybrid': 'Гибрид',
      'electro': 'Электро'
    },
    driveTypes: {
      'fwd': 'Передний',
      'rwd': 'Задний',
      '4wd': 'Полный'
    }
  };

  /**
   * Парсинг характеристик автомобиля из каталогов Avito (catalogs.avito.ru)
   */
  function parseAvitoCatalogData() {
    console.log('[FrontClicker] Парсинг данных каталога...');
    const specs = {};
    
    // Извлечение спецификаций со страницы каталога
    document.querySelectorAll('[data-marker*="spec-item"]').forEach((item) => {
      const label = item.querySelector('[class*="title"]')?.innerText?.trim();
      const value = item.querySelector('[class*="description"]')?.innerText?.trim();
      if (label && value) {
        specs[label] = value;
      }
    });

    return specs;
  }


  // ==========================================================================
  // 3. ОСНОВНАЯ ЛОГИКА И АВТОЗАПОЛНЕНИЕ ФОРМЫ (ранее additem.js)
  // ==========================================================================

  /**
   * Главный сценарий кликера для формы подача/редактирования (avito.ru/additem)
   */
  async function runFormFiller() {
    const currentUrl = window.location.href;
    
    // Выполняем автозаполнение только на странице формы подача объявления
    if (!currentUrl.includes('avito.ru/additem')) {
      console.log('[FrontClicker] Текущая страница не является формой additem.');
      return;
    }

    console.log('[FrontClicker] Старт автозаполнения формы additem...');

    try {
      // 1. Выбираем нужные радио-баттоны или выпадающие списки
      const categoryField = await waitForElement('[data-marker="category-select"]', 5000).catch(() => null);
      if (categoryField) {
        triggerClick(categoryField);
        await sleep(500);
      }

      // 2. Пример использования забора данных из Google Таблицы (если сохранен URL)
      // const tableData = await fetchTableData("YOUR_GOOGLE_SCRIPT_URL", { action: "get_item" });

      console.log('[FrontClicker] Заполнение полей завершено.');
    } catch (err) {
      console.error('[FrontClicker] Ошибка в процессе заполнении формы:', err);
    }
  }


  // ==========================================================================
  // 4. ЭКСПОРТ В ГЛОБАЛЬНЫЙ КОНТЕКСТ WINDOW И ИНИЦИАЛИЗАЦИЯ
  // ==========================================================================

  // Привязываем все ключевые функции и объекты к window (решает проблему "is not defined")
  window.FrontClicker = {
    sleep,
    waitForElement,
    triggerClick,
    setInputValue,
    fetchTableData,
    AUTO_CATALOG,
    parseAvitoCatalogData,
    runFormFiller
  };

  // Прямой экспорт fetchTableData в корень window для обратной совместимости
  window.fetchTableData = fetchTableData;
  window.waitForElement = waitForElement;
  window.triggerClick = triggerClick;
  window.setInputValue = setInputValue;

  // Автоматический запуск логики
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      runFormFiller();
    });
  } else {
    runFormFiller();
  }

})();
