(function() {
  'use strict';

  // 1. Защита от повторного внедрения на страницу
  if (window.__avitoAutofillInjected) return;
  window.__avitoAutofillInjected = true;

  const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/849d55c8-5979-4b8e-a23c-b93fb34444db';

  // 2. Создание интерфейса скрипта (кнопки, формы)
  function initUI() {
    // Создаем контейнер-оверлей
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'autofill-modal-overlay';
    
    Object.assign(modalOverlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(3px)',
      zIndex: '2147483647',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'sans-serif'
    });

    modalOverlay.innerHTML = `
      <div style="
        background: #1e1e2e; color: #cdd6f4; padding: 20px; border-radius: 12px;
        width: 450px; max-width: 90vw; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        border: 1px solid #313244; display: flex; flex-direction: column; gap: 12px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 15px; color: #cdd6f4;">🚙 AutoFill v2.0</h3>
          <span id="af-close-btn" style="cursor: pointer; font-size: 18px; color: #a6adc8; user-select: none;">✕</span>
        </div>

        <textarea id="af-input-data" rows="5" placeholder="Вставьте данные для автозаполнения..." style="
          width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px;
          background: #11111b; color: #cdd6f4; border: 1px solid #45475a;
          font-size: 13px; outline: none; resize: vertical;
        "></textarea>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
          <button id="af-cancel-btn" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #45475a; background: transparent; color: #cdd6f4; cursor: pointer;">Отмена</button>
          <button id="af-submit-btn" style="padding: 6px 16px; border-radius: 6px; border: none; background: #89b4fa; color: #11111b; font-weight: 600; cursor: pointer;">Заполнить</button>
        </div>
      </div>
    `;

    // Вставка в DOM
    if (document.body) {
      document.body.appendChild(modalOverlay);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(modalOverlay));
    }

    // Получаем прямые ссылки на элементы UI
    const closeBtn = modalOverlay.querySelector('#af-close-btn');
    const cancelBtn = modalOverlay.querySelector('#af-cancel-btn');
    const submitBtn = modalOverlay.querySelector('#af-submit-btn');
    const inputArea = modalOverlay.querySelector('#af-input-data');

    function closeModal() {
      modalOverlay.style.display = 'none';
    }

    function openModal() {
      modalOverlay.style.display = 'flex';
      inputArea.focus();
    }

    // Привязываем события закрытия напрямую
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Основное действие скрипта
    submitBtn.addEventListener('click', async () => {
      const rawData = inputArea.value.trim();
      if (!rawData) return;

      submitBtn.disabled = true;
      submitBtn.innerText = '⏳ Заполнение...';

      try {
        // Логика заполнения полей на Avito...
        console.log('Обработка данных:', rawData);

        closeModal();
      } catch (err) {
        alert(`Ошибка при автозаполнении: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Заполнить';
      }
    });

    // Экспортируем функцию открытия для вызова из кнопки/меню
    window.__openAutofillUI = openModal;
  }

  // Запуск инициализации UI
  initUI();
})();
