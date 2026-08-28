(function() {
  'use strict';

  // 1. Защита от повторного внедрения логики
  if (window.__avitoAutofillInjected) return;
  window.__avitoAutofillInjected = true;

  const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/849d55c8-5979-4b8e-a23c-b93fb34444db';

  let buttonCreated = false;

  // 2. Улучшенная функция ожидания элемента в DOM (с MutationObserver)
  function waitForElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
      callback(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        callback(element);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // 3. Создание кнопки-триггера на странице
  function createTriggerButton() {
    if (document.getElementById('autofill-trigger-btn')) {
      return;
    }

    const radioGroup = document.querySelector('div[data-userscript-marker="commentFormTopControlsTypeSwitch/type-switch-marker"]');

    if (!radioGroup) {
      setTimeout(createTriggerButton, 100);
      return;
    }

    buttonCreated = true;

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'autofill-trigger-btn';
    buttonContainer.style.cssText = `
      display: inline-flex;
      align-items: center;
      margin-left: 12px;
      vertical-align: middle;
    `;

    const triggerButton = document.createElement('button');
    triggerButton.textContent = '🚙 AutoFill';
    triggerButton.type = 'button';
    triggerButton.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 14px;
      height: 32px;
      font-size: 13px;
      font-family: inherit;
      font-weight: 500;
      line-height: 32px;
      color: #fff;
      background-color: #1890ff;
      border: 1px solid #1890ff;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      box-sizing: border-box;
      outline: none;
    `;

    triggerButton.addEventListener('mouseenter', () => {
      triggerButton.style.backgroundColor = '#40a9ff';
      triggerButton.style.borderColor = '#40a9ff';
    });

    triggerButton.addEventListener('mouseleave', () => {
      triggerButton.style.backgroundColor = '#1890ff';
      triggerButton.style.borderColor = '#1890ff';
    });

    triggerButton.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openModal();
    });

    buttonContainer.appendChild(triggerButton);
    radioGroup.parentElement.appendChild(buttonContainer);
  }

  // 4. Создание и управление модальным окном
  function initModalUI() {
    if (document.getElementById('autofill-modal-overlay')) return;

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

    document.body.appendChild(modalOverlay);

    const closeBtn = modalOverlay.querySelector('#af-close-btn');
    const cancelBtn = modalOverlay.querySelector('#af-cancel-btn');
    const submitBtn = modalOverlay.querySelector('#af-submit-btn');
    const inputArea = modalOverlay.querySelector('#af-input-data');

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    submitBtn.addEventListener('click', async () => {
      const rawData = inputArea.value.trim();
      if (!rawData) return;

      submitBtn.disabled = true;
      submitBtn.innerText = '⏳ Заполнение...';

      try {
        console.log('Обработка данных:', rawData);
        closeModal();
      } catch (err) {
        alert(`Ошибка при автозаполнении: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Заполнить';
      }
    });

    overlayClickClose(modalOverlay);
  }

  function openModal() {
    initModalUI();
    const modalOverlay = document.getElementById('autofill-modal-overlay');
    const inputArea = document.getElementById('af-input-data');
    if (modalOverlay) {
      modalOverlay.style.display = 'flex';
      if (inputArea) inputArea.focus();
    }
  }

  function closeModal() {
    const modalOverlay = document.getElementById('autofill-modal-overlay');
    if (modalOverlay) {
      modalOverlay.style.display = 'none';
    }
  }

  function overlayClickClose(overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  // 5. Обработка SPA-навигации (PushState, ReplaceState, PopState, Observer)
  function init() {
    buttonCreated = false;
    waitForElement('div[data-userscript-marker="commentFormTopControlsTypeSwitch/type-switch-marker"]', createTriggerButton);
  }

  init();

  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (url.match(/\/helpdesk\/details\//)) {
        setTimeout(init, 300);
      }
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    window.dispatchEvent(new Event('pushstate'));
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event('replacestate'));
  };

  window.addEventListener('pushstate', () => {
    setTimeout(() => { if (location.href.match(/\/helpdesk\/details\//)) init(); }, 300);
  });

  window.addEventListener('replacestate', () => {
    setTimeout(() => { if (location.href.match(/\/helpdesk\/details\//)) init(); }, 300);
  });

  window.addEventListener('popstate', () => {
    setTimeout(() => { if (location.href.match(/\/helpdesk\/details\//)) init(); }, 300);
  });

  window.__openAutofillUI = openModal;
})();
