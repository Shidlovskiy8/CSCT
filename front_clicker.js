(function() {
    'use strict';

    const BUTTON_ID = 'tm-inline-webhook-btn';

    // Проверка URL
    const currentUrl = window.location.href;
    
    if (!currentUrl.startsWith('https://catalogs.avito.ru/catalog/')) {
        return;
    }
    
    if (!currentUrl.includes('/modifications/')) {
        return;
    }

    // Защита от повторной инициализации
    if (window.__searchIdScriptInjected) return;
    window.__searchIdScriptInjected = true;

    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25';
    const API_KEY = ''; 

    // ==========================================
    // 1. СОЗДАНИЕ КНОПКИ
    // ==========================================
    function createInlineButton() {
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.textContent = '🚀 Автоклик';
        btn.title = 'Собрать и отправить все параметры';
        
        btn.style.cssText = `
            margin-left: 8px; 
            padding: 4px 10px; 
            background-color: #00aaff;
            color: #ffffff; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 12px; 
            font-weight: bold; 
            vertical-align: middle; 
            z-index: 9999;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = '#0099e6';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = '#00aaff';
        });

        return btn;
    }

    // ==========================================
    // 2. МОДАЛЬНОЕ ОКНО (с формой и результатом)
    // ==========================================
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
                <h3 style="margin: 0; font-size: 15px; color: #cdd6f4;">Отправка данных</h3>
                <span id="tm-close" style="cursor: pointer; font-size: 18px; color: #a6adc8;">✕</span>
            </div>

            <!-- Форма ручного ввода (как было раньше) -->
            <div id="tm-manual-input-block">
                <textarea id="tm-input" placeholder="Введите комплектацию для поиска ID (или оставьте пустым для авто-сбора)..." rows="3" style="
                    width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px;
                    background: #11111b; color: #cdd6f4; border: 1px solid #45475a;
                    font-size: 13px; outline: none; resize: vertical;
                "></textarea>
            </div>

            <!-- Блок результата -->
            <div id="tm-response-container" style="display: none; flex-direction: column; gap: 6px;">
                <span style="font-size: 12px; font-weight: 600; color: #a6e3a1;">📥 Ответ сервера:</span>
                <div id="tm-response-output" style="
                    background: #11111b; border: 1px solid #45475a; border-radius: 8px;
                    padding: 10px; font-size: 12px; color: #a6adc8; max-height: 250px;
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
        // Если выделен текст на странице, подставляем его
        const sel = window.getSelection().toString();
        if (sel && !input.value) input.value = sel;
        
        modalOverlay.style.display = 'flex';
        responseBox.style.display = 'none';
        responseOutput.innerText = '';
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

    // ==========================================
    // 3. СБОР ДАННЫХ ИЗ КОНТЕЙНЕРА (АВТО)
    // ==========================================
    function collectParamsData() {
        const params = {};
        const labelEl = document.querySelector('[data-marker="modification-name/label"]');
        const modificationId = labelEl ? labelEl.textContent.replace('Модификация:', '').trim() : '';
        
        // Собираем все параметры
        document.querySelectorAll('div[data-marker="modification/param"]').forEach(row => {
            const nameLink = row.querySelector('a[data-marker="modification/param-name-link"]');
            if (!nameLink) return;

            const paramName = nameLink.textContent.trim();
            const values = [];
            
            // Собираем все значения (может быть несколько через запятую)
            const valueLinks = row.querySelectorAll('a[data-marker="modification/value-name-link"]');
            
            if (valueLinks.length > 0) {
                valueLinks.forEach(link => {
                    const val = link.textContent.trim();
                    if (val) values.push(val);
                });
            } else {
                // Фоллбэк: если нет ссылок, берём текст из контейнера
                const valContainer = row.querySelector('[class*="valueList"], [class*="valueLabel"]');
                if (valContainer) {
                    const val = valContainer.textContent.trim();
                    if (val) values.push(val);
                }
            }

            if (values.length > 0) {
                params[paramName] = values.length === 1 ? values[0] : values;
            }
        });

        return {
            mode: 'auto_collect',
            modification_id: modificationId,
            url: window.location.href,
            title: document.title,
            params: params,
            params_count: Object.keys(params).length
        };
    }

    // ==========================================
    // 4. ОБРАБОТЧИК КЛИКА ПО КНОПКЕ "ОТПРАВИТЬ"
    // ==========================================
    submitBtn.addEventListener('click', async () => {
        const manualText = input.value.trim();
        
        // Если текст введён вручную — отправляем как раньше
        if (manualText) {
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
                        mode: 'manual',
                        text: manualText,
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
                responseOutput.innerText = `Сетевая ошибка: ${err.message}`;
            }
            return;
        }

        // Если текст НЕ введён — собираем все параметры автоматически
        submitBtn.disabled = true;
        submitBtn.innerText = '⏳ Сбор параметров...';
        responseBox.style.display = 'none';

        try {
            const data = collectParamsData();
            
            console.log('[TM] Собранные данные:', data);

            const headers = { 'Content-Type': 'application/json' };
            if (API_KEY) headers['X-API-Key'] = API_KEY;

            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });

            submitBtn.disabled = false;
            submitBtn.innerText = 'Отправить';
            responseBox.style.display = 'flex';

            const responseText = await res.text();

            if (res.ok) {
                try {
                    const json = JSON.parse(responseText);
                    responseOutput.innerText = `✅ Успешно!\nСобрано параметров: ${data.params_count}\n\nОтвет сервера:\n` + 
                        (typeof json === 'object' ? JSON.stringify(json, null, 2) : json);
                } catch (e) {
                    responseOutput.innerText = `✅ Успешно!\nСобрано параметров: ${data.params_count}\n\nОтвет сервера:\n${responseText}`;
                }
            } else {
                responseOutput.innerText = `Ошибка ${res.status}:\n${responseText}`;
            }
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Отправить';
            responseBox.style.display = 'flex';
            responseOutput.innerText = `Ошибка сбора/отправки: ${err.message}`;
        }
    });

    // ==========================================
    // 5. ВСТРАИВАНИЕ КНОПКИ В DOM
    // ==========================================
    function injectButton() {
        // Если кнопка уже есть — выходим
        if (document.getElementById(BUTTON_ID)) {
            return;
        }

        // Ищем целевой элемент для вставки
        const targetEl = document.querySelector('button[data-marker="modification-name/historyBtn"]') ||
                         document.querySelector('[data-marker="modification-name/label"]');

        if (!targetEl) {
            // Элементы ещё не загрузились, ждём
            return;
        }

        const btn = createInlineButton();
        btn.addEventListener('click', openModal);

        if (targetEl.parentNode) {
            targetEl.parentNode.insertBefore(btn, targetEl.nextSibling);
            console.log('[TM] Кнопка успешно добавлена');
        }
    }

    // ==========================================
    // 6. ЗАПУСК
    // ==========================================
    
    // Добавляем модальное окно в body
    if (document.body) {
        document.body.appendChild(modalOverlay);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(modalOverlay);
        });
    }

    // Серия попыток вставки кнопки
    setTimeout(injectButton, 100);
    setTimeout(injectButton, 500);
    setTimeout(injectButton, 1000);
    setTimeout(injectButton, 2000);

    // Наблюдатель за изменениями в DOM
    const observer = new MutationObserver(() => {
        injectButton();
    });
    
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Наблюдатель за сменой URL (SPA переходы)
    let lastHref = window.location.href;
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastHref) {
            lastHref = window.location.href;
            // Сбрасываем флаг при переходе на новую страницу
            window.__searchIdScriptInjected = false;
            injectButton();
        }
    });
    
    if (document.head) {
        urlObserver.observe(document.head, { childList: true, subtree: true });
    }

    // Первый вызов
    injectButton();
})();
