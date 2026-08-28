(function() {
    'use strict';

    if (!window.location.href.startsWith('https://catalogs.avito.ru/catalog/')) {
        return;
    }

    if (window.__modParamsScriptInjected) return;
    window.__modParamsScriptInjected = true;

    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25';
    const API_KEY = ''; 

    // Создание модального окна с текстовым полем для ввода комментария/описания
    const modalOverlay = document.createElement('div');
    Object.assign(modalOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(3px)',
        zIndex: '2147483647', display: 'none', justifyContent: 'center',
        alignItems: 'center', fontFamily: 'sans-serif'
    });

    modalOverlay.innerHTML = `
        <div style="
            background: #1e1e2e; color: #cdd6f4; padding: 20px; border-radius: 12px;
            width: 450px; max-width: 90vw; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            border: 1px solid #313244; display: flex; flex-direction: column; gap: 12px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 15px; color: #cdd6f4;">Отправка параметров модификации</h3>
                <span id="tm-close" style="cursor: pointer; font-size: 18px; color: #a6adc8;">✕</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="tm-user-input" style="font-size: 12px; color: #a6adc8;">Ваше сообщение / комментарий:</label>
                <textarea id="tm-user-input" rows="3" placeholder="Введите текст, который отправится вместе с данными..." style="
                    background: #11111b; border: 1px solid #45475a; border-radius: 8px;
                    padding: 8px; font-size: 12px; color: #cdd6f4; resize: vertical; font-family: sans-serif;
                "></textarea>
            </div>

            <div id="tm-response-container" style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 12px; font-weight: 600; color: #a6e3a1;" id="tm-status-title">📥 Ответ сервера:</span>
                <div id="tm-response-output" style="
                    background: #11111b; border: 1px solid #45475a; border-radius: 8px;
                    padding: 10px; font-size: 12px; color: #a6adc8; max-height: 200px;
                    overflow-y: auto; white-space: pre-wrap; font-family: monospace;
                "></div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                <button id="tm-cancel" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #45475a; background: transparent; color: #cdd6f4; cursor: pointer;">Закрыть</button>
                <button id="tm-submit" style="padding: 6px 14px; border-radius: 6px; border: none; background: #ff6600; color: #ffffff; cursor: pointer; font-weight: 600;">Отправить</button>
            </div>
        </div>
    `;

    const cancelBtn = modalOverlay.querySelector('#tm-cancel');
    const closeBtn = modalOverlay.querySelector('#tm-close');
    const submitBtn = modalOverlay.querySelector('#tm-submit');
    const userInput = modalOverlay.querySelector('#tm-user-input');
    const responseOutput = modalOverlay.querySelector('#tm-response-output');
    const statusTitle = modalOverlay.querySelector('#tm-status-title');

    function closeModal() {
        modalOverlay.style.display = 'none';
    }

    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    // Функция сбора параметров из DOM
    function collectModificationData(customMessage = '') {
        const rootContainer = document.querySelector('.styles-module-root-I6AxT');
        const data = {
            url: window.location.href,
            title: document.title,
            message: customMessage,
            parameters: {}
        };

        if (!rootContainer) return data;

        const labelEl = rootContainer.querySelector('[data-marker="modification-name/label"]');
        if (labelEl) {
            data.modificationName = labelEl.textContent.trim();
        }

        const paramRows = rootContainer.querySelectorAll('[data-marker="modification/param"]');
        paramRows.forEach(row => {
            const nameLink = row.querySelector('[data-marker="modification/param-name-link"]');
            const valueLink = row.querySelector('[data-marker="modification/value-name-link"]');
            
            if (nameLink && valueLink) {
                const paramName = nameLink.textContent.trim();
                const paramValue = valueLink.textContent.trim();
                data.parameters[paramName] = paramValue;
            }
        });

        return data;
    }

    let activeBtnInstance = null;

    // При клике на иконку просто открываем модальное окно и очищаем старый вывод
    function handleIconClick() {
        userInput.value = '';
        responseOutput.innerText = 'Ожидание отправки...';
        statusTitle.style.color = '#89b4fa';
        statusTitle.textContent = 'ℹ️ Статус:';
        modalOverlay.style.display = 'flex';
        userInput.focus();
    }

    // Кнопка «Отправить» внутри модального окна
    submitBtn.addEventListener('click', async () => {
        const messageText = userInput.value.trim();
        const payload = collectModificationData(messageText);

        submitBtn.style.opacity = '0.6';
        submitBtn.style.pointerEvents = 'none';

        const headers = { 'Content-Type': 'application/json' };
        if (API_KEY) headers['X-API-Key'] = API_KEY;

        statusTitle.style.color = '#89b4fa';
        statusTitle.textContent = '⏳ Отправка данных...';
        responseOutput.innerText = JSON.stringify(payload, null, 2);

        try {
            // Отправка через background-скрипт (или напрямую, если CORS настроен)
            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const responseText = await res.text();
            statusTitle.style.color = '#a6e3a1';
            statusTitle.textContent = '📥 Ответ сервера:';

            if (res.ok) {
                try {
                    const json = JSON.parse(responseText);
                    responseOutput.innerText = typeof json === 'object'
                        ? JSON.stringify(json, null, 2)
                        : json;
                } catch (e) {
                    responseOutput.innerText = responseText || '(Пустой ответ)';
                }
            } else {
                responseOutput.innerText = `Ошибка ${res.status}:\n${responseText}`;
            }
        } catch (err) {
            statusTitle.style.color = '#f38ba8';
            statusTitle.textContent = '❌ Ошибка сети:';
            responseOutput.innerText = err.message;
        } finally {
            submitBtn.style.opacity = '1';
            submitBtn.style.pointerEvents = 'auto';
        }
    });

    // Создание элемента кнопки
    function createInlineButton() {
        const btn = document.createElement('div');
        btn.id = 'tm-inline-webhook-btn';
        btn.title = 'Открыть окно отправки параметров';

        Object.assign(btn.style, {
            width: '24px',
            height: '24px',
            backgroundColor: '#ff6600',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginLeft: '6px',
            marginRight: '4px',
            flexShrink: '0',
            transition: 'background-color 0.2s ease',
            userSelect: 'none',
            pointerEvents: 'auto'
        });

        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        `;

        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#e65c00');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#ff6600');
        btn.addEventListener('click', handleIconClick);

        return btn;
    }

    function injectButton() {
        const targetContainer = document.querySelector('.styles-module-root-oD3Gk');

        if (targetContainer && !document.getElementById('tm-inline-webhook-btn')) {
            const btn = createInlineButton();
            targetContainer.appendChild(btn);
        }
    }

    if (document.body) {
        document.body.appendChild(modalOverlay);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(modalOverlay));
    }

    const observer = new MutationObserver(injectButton);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    injectButton();
})();
