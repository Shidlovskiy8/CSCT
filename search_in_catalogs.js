/**
 * Avito Catalogs: Auto-Collect Button
 * Чистый JS для вставки кнопки сбора параметров модификации.
 * Работает на страницах: https://catalogs.avito.ru/catalog/*/modifications/*
 * 
 * Установка:
 * 1. Сохранить как script.js
 * 2. Запускать через консоль браузера или расширение для инъекции JS.
 */

(function() {
    'use strict';

    // --- КОНФИГУРАЦИЯ ---
    const CONFIG = {
        BUTTON_ID: 'tm-inline-webhook-btn',
        MODAL_ID: 'tm-modal-overlay',
        WEBHOOK_URL: 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25',
        API_KEY: '', // Оставьте пустым, если не нужен
        CHECK_INTERVAL_MS: 800 // Как часто проверять наличие кнопки
    };

    // --- ПРОВЕРКА URL ---
    function isValidUrl() {
        const href = window.location.href;
        return href.startsWith('https://catalogs.avito.ru/catalog/') && 
               href.includes('/modifications/');
    }

    if (!isValidUrl()) {
        console.log('[AvitoScript] Страница не подходит, скрипт остановлен.');
        return;
    }

    console.log('[AvitoScript] Запуск скрипта на странице:', window.location.href);

    // --- 1. СОЗДАНИЕ КНОПКИ ---
    function createButtonElement() {
        const btn = document.createElement('button');
        btn.id = CONFIG.BUTTON_ID;
        btn.type = 'button';
        btn.textContent = '🚀 Автоклик';
        btn.title = 'Собрать и отправить все параметры';

        // Стили через cssText для изоляции
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
            display: inline-block;
            transition: background-color 0.2s;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        `;

        // Ховер-эффекты
        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#0099e6');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#00aaff');

        return btn;
    }

    // --- 2. МОДАЛЬНОЕ ОКНО (Синглтон) ---
    function getModalOverlay() {
        let modal = document.getElementById(CONFIG.MODAL_ID);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = CONFIG.MODAL_ID;
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(3px);
                z-index: 2147483647; display: none; justify-content: center;
                align-items: center; font-family: sans-serif;
            `;

            modal.innerHTML = `
                <div style="
                    background: #1e1e2e; color: #cdd6f4; padding: 20px; border-radius: 12px;
                    width: 450px; max-width: 90vw; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    border: 1px solid #313244; display: flex; flex-direction: column; gap: 12px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 15px; color: #cdd6f4;">Отправка данных</h3>
                        <span id="tm-close" style="cursor: pointer; font-size: 18px; color: #a6adc8;">✕</span>
                    </div>

                    <textarea id="tm-input" placeholder="Введите текст (или оставьте пустым для авто-сбора)..." rows="3" style="
                        width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px;
                        background: #11111b; color: #cdd6f4; border: 1px solid #45475a;
                        font-size: 13px; outline: none; resize: vertical; font-family: monospace;
                    "></textarea>

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
            
            document.body.appendChild(modal);

            // Навешиваем обработчики закрытия
            const closeBtn = modal.querySelector('#tm-close');
            const cancelBtn = modal.querySelector('#tm-cancel');
            const closeModalFunc = () => { modal.style.display = 'none'; };
            
            closeBtn.onclick = closeModalFunc;
            cancelBtn.onclick = closeModalFunc;
            
            // Закрытие по клику вне окна
            modal.onclick = (e) => {
                if (e.target === modal) closeModalFunc();
            };
        }
        return modal;
    }

    // --- 3. СБОР ДАННЫХ ---
    function collectParamsData() {
        const params = {};
        const labelEl = document.querySelector('[data-marker="modification-name/label"]');
        const modificationId = labelEl ? labelEl.textContent.replace('Модификация:', '').trim() : '';

        document.querySelectorAll('div[data-marker="modification/param"]').forEach(row => {
            const nameLink = row.querySelector('a[data-marker="modification/param-name-link"]');
            if (!nameLink) return;
            
            const paramName = nameLink.textContent.trim();
            const values = [];
            
            // Собираем все значения (ссылки)
            const valueLinks = row.querySelectorAll('a[data-marker="modification/value-name-link"]');
            if (valueLinks.length > 0) {
                valueLinks.forEach(link => {
                    const val = link.textContent.trim();
                    if (val) values.push(val);
                });
            } else {
                // Фоллбэк: текст из контейнера
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

    // --- 4. ЛОГИКА ОТПРАВКИ ---
    function handleSendClick() {
        const modal = getModalOverlay();
        const input = modal.querySelector('#tm-input');
        const submitBtn = modal.querySelector('#tm-submit');
        const responseBox = modal.querySelector('#tm-response-container');
        const responseOutput = modal.querySelector('#tm-response-output');

        const manualText = input.value.trim();
        
        submitBtn.disabled = true;
        submitBtn.innerText = '⏳ ...';
        responseBox.style.display = 'flex';
        responseOutput.innerText = '';

        let payload;
        if (manualText) {
            payload = { 
                mode: 'manual', 
                text: manualText, 
                url: window.location.href, 
                title: document.title 
            };
        } else {
            payload = collectParamsData();
            console.log('[AvitoScript] Собранные данные:', payload);
        }

        fetch(CONFIG.WEBHOOK_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(CONFIG.API_KEY ? {'X-API-Key': CONFIG.API_KEY} : {})
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.text())
        .then(text => {
            let displayText = text;
            try {
                const json = JSON.parse(text);
                displayText = JSON.stringify(json, null, 2);
            } catch (e) { /* ignore */ }
            
            responseOutput.innerText = res.ok 
                ? `✅ Успешно!\nПараметров: ${payload.params_count || 0}\n\nОтвет:\n${displayText}`
                : `❌ Ошибка ${res.status}:\n${displayText}`;
        })
        .catch(err => {
            responseOutput.innerText = `❌ Сетевая ошибка: ${err.message}`;
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Отправить';
        });
    }

    // --- 5. ВСТРАИВАНИЕ КНОПКИ ---
    function injectButton() {
        // Если кнопка уже есть — ничего не делаем
        if (document.getElementById(CONFIG.BUTTON_ID)) {
            return;
        }

        // Ищем точку вставки
        // Приоритет: после кнопки истории, иначе после лейбла
        const target = document.querySelector('button[data-marker="modification-name/historyBtn"]') ||
                       document.querySelector('[data-marker="modification-name/label"]');

        if (!target || !target.parentElement) {
            // Элементы ещё не отрисованы, ждём следующей итерации
            return;
        }

        const btn = createButtonElement();
        
        // Обработчик клика: открываем модалку
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const modal = getModalOverlay();
            const input = modal.querySelector('#tm-input');
            
            // Автозаполнение выделенным текстом если есть
            const sel = window.getSelection().toString();
            if (sel && !input.value) input.value = sel;
            
            modal.style.display = 'flex';
            input.focus();
        });

        // Вставляем кнопку ПОСЛЕ целевого элемента
        target.parentElement.insertBefore(btn, target.nextSibling);
        console.log('[AvitoScript] Кнопка успешно внедрена');
    }

    // --- 6. ЗАПУСК И НАБЛЮДЕНИЕ ---
    function init() {
        // Гарантируем наличие модалки в DOM
        getModalOverlay();
        
        // Навешиваем глобальный обработчик отправки (чтобы работал даже при пересоздании кнопки)
        const modal = getModalOverlay();
        const submitBtn = modal.querySelector('#tm-submit');
        // Удаляем старые обработчики клонированием (грубый метод) или просто перезаписываем onclick
        submitBtn.onclick = handleSendClick;

        // 1. Первая попытка
        injectButton();

        // 2. Повторные попытки для надежности
        setTimeout(injectButton, 300);
        setTimeout(injectButton, 1000);
        setTimeout(injectButton, 2000);

        // 3. MutationObserver: следит за изменениями DOM (подгрузка контента)
        const observer = new MutationObserver(() => {
            injectButton();
        });
        
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // 4. Интервальный чекап: возвращает кнопку, если она пропала (SPA-переходы)
        setInterval(() => {
            // Проверяем, не ушли ли мы с страницы каталога
            if (!isValidUrl()) {
                return; 
            }
            injectButton();
        }, CONFIG.CHECK_INTERVAL_MS);
    }

    // Запуск после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
