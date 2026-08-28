// front_clicker.js
(function() {
    'use strict';

    // Проверка URL: запускаем скрипт только на страницах автокаталога Avito
    if (!window.location.href.startsWith('https://catalogs.avito.ru/catalog/auto/')) {
        return;
    }

    // Защита от повторной инициализации
    if (window.__carParamsWebhookInjected) return;
    window.__carParamsWebhookInjected = true;

    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook-test/d1022c79-45b8-4971-9712-53ccd03cbd25';
    const BUTTON_ID = 'tm-inline-webhook-btn';

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

    // 2. ИЗВЛЕЧЕНИЕ ПАРАМЕТРОВ АВТОМОБИЛЯ
    function extractCarParameters() {
        const data = {};
        const paramRows = document.querySelectorAll('div[data-marker="modification/param"]');

        paramRows.forEach(row => {
            const nameEl = row.querySelector('a[data-marker="modification/param-name-link"]');
            const valueEls = row.querySelectorAll('a[data-marker="modification/value-name-link"]');

            if (nameEl) {
                const paramName = nameEl.textContent.trim();
                const values = Array.from(valueEls).map(el => el.textContent.trim());

                data[paramName] = values.length === 1 ? values[0] : values;
            }
        });

        return data;
    }

    // 3. ОБРАБОТЧИК КЛИКА И ОТПРАВКА
    async function handleWebhookSend(btn) {
        const carData = extractCarParameters();
        
        const originalHTML = btn.innerHTML;
        btn.style.pointerEvents = 'none';
        btn.style.backgroundColor = '#585b70';
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" style="animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
            </svg>
        `;

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parameters: carData,
                    url: window.location.href,
                    title: document.title
                })
            });

            if (response.ok) {
                btn.style.backgroundColor = '#a6e3a1';
                setTimeout(() => {
                    btn.style.backgroundColor = '#ff6600';
                    btn.innerHTML = originalHTML;
                    btn.style.pointerEvents = 'auto';
                }, 1500);
            } else {
                throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Webhook error:', error);
            btn.style.backgroundColor = '#f38ba8';
            setTimeout(() => {
                btn.style.backgroundColor = '#ff6600';
                btn.innerHTML = originalHTML;
                btn.style.pointerEvents = 'auto';
            }, 2000);
        }
    }

    // 4. ВСТРАИВАНИЕ КНОПКИ В DOM
    function injectButton() {
        const container = document.querySelector('div.styles-module-root-oD3Gk');
        
        if (container && !document.getElementById(BUTTON_ID)) {
            const btn = createInlineButton();
            btn.addEventListener('click', () => handleWebhookSend(btn));
            container.appendChild(btn);
        }
    }

    const observer = new MutationObserver(injectButton);
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    injectButton();
})();
