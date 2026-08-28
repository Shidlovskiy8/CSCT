(function() {
    'use strict';

    const BUTTON_ID = 'tm-inline-webhook-btn';

    // Проверка URL: запускаем скрипт на страницах любого каталога Avito с модификациями
    if (!window.location.href.startsWith('https://catalogs.avito.ru/catalog/')) {
        return;
    }
    
    // Дополнительная проверка: страница должна содержать /modifications/ в пути
    if (!window.location.href.includes('/modifications/')) {
        return;
    }

    // Защита от повторной инициализации
    if (window.__searchIdScriptInjected) return;
    window.__searchIdScriptInjected = true;

    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25';
    const API_KEY = ''; 

    // 1. СОЗДАНИЕ ИНЛАЙН-КНОПКИ
    function createInlineButton() {
        const btn = document.createElement('div');
        btn.id = BUTTON_ID;
        btn.title = 'Отправить параметры на вебхук';

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
            userSelect: 'none'
        });

        // Иконка передачи/облака
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        `;

        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#e65c00');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#ff6600');

        return btn;
    }

    // 2. МОДАЛЬНОЕ ОКНО
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
                <h3 style="margin: 0; font-size: 15px; color: #cdd6f4;">Поиск ID для комплектации в БД</h3>
                <span id="tm-close" style="cursor: pointer; font-size: 18px; color: #a6adc8;">✕</span>
            </div>

            <textarea id="tm-input" placeholder="Введите комплектацию для поиска ID..." rows="4" style="
                width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px;
                background: #11111b; color: #cdd6f4; border: 1px solid #45475a;
                font-size: 13px; outline: none; resize: vertical;
            "></textarea>

            <div id="tm-response-container" style="display: none; flex-direction: column; gap: 6px;">
                <span style="font-size: 12px; font-weight: 600; color: #a6e3a1;">📥 Найденные ID:</span>
                <div id="tm-response-output" style="
                    background: #11111b; border: 1px solid #45475a; border-radius: 8px;
                    padding: 10px; font-size: 12px; color: #a6adc8; max-height: 180px;
                    overflow-y: auto; white-space: pre-wrap; font-family: monospace;
                "></div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                <button id="tm-cancel" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #45475a; background: transparent; color: #cdd6f4; cursor: pointer;">Закрыть</button>
                <button id="tm-submit" style="padding: 6px 16px; border-radius: 6px; border: none; background: #89b4fa; color: #11111b; font-weight: 600; cursor: pointer;">Отправить</button>
            </div>
        </div>
    `;

    const input = modalOverlay.querySelector('#tm-input');
    const submitBtn = modalOverlay.querySelector('#tm-submit');
    const cancelBtn = modalOverlay.querySelector('#tm-cancel');
    const closeBtn = modalOverlay.querySelector('#tm-close');
    const responseBox = modalOverlay.querySelector('#tm-response-container');
    const responseOutput = modalOverlay.querySelector('#tm-response-output');

    function openModal() {
        const sel = window.getSelection().toString();
        if (sel && !input.value) input.value = sel;
        modalOverlay.style.display = 'flex';
        input.focus();
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
        responseBox.style.display = 'none';
        responseOutput.innerText = '';
        submitBtn.disabled = false;
        submitBtn.innerText = 'Отправить';
    }

    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    submitBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) return;

        submitBtn.disabled = true;
        submitBtn.innerText = '⏳ Обработка...';
        responseBox.style.display = 'none';

        const headers = { 'Content-Type': 'application/json' };
        if (API_KEY) headers['X-API-Key'] = API_KEY;

        try {
            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    text: text,
                    url: window.location.href,
                    title: document.title
                })
            });

            submitBtn.disabled = false;
            submitBtn.innerText = 'Отправить';
            responseBox.style.display = 'flex';

            const responseText = await res.text();

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
            submitBtn.disabled = false;
            submitBtn.innerText = 'Отправить';
            responseBox.style.display = 'flex';
            responseOutput.innerText = `Сетевая ошибка при запросе к n8n: ${err.message}`;
        }
    });

    // 3. ВСТРАИВАНИЕ КНОПКИ В DOM
    function injectButton() {
        // Ищем блок с модификацией по data-marker="modification-name/label"
        const labelElement = document.querySelector('[data-marker="modification-name/label"]');
        
        if (!labelElement) return;
        
        // Находим родительский контейнер (div.styles-module-root-oD3Gk)
        const targetContainer = labelElement.parentElement;
        
        if (targetContainer && !document.getElementById(BUTTON_ID)) {
            const btn = createInlineButton();
            btn.addEventListener('click', openModal);

            // Вставляем кнопку ПОСЛЕ всех существующих детей контейнера
            // Это разместит её справа от кнопок copy и history
            targetContainer.appendChild(btn);
        }
    }

    // Запуск встраивания
    if (document.body) {
        document.body.appendChild(modalOverlay);
        setTimeout(injectButton, 100);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(modalOverlay);
            setTimeout(injectButton, 100);
        });
    }

    const observer = new MutationObserver(injectButton);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    injectButton();
})();
