(function() {
    'use strict';

    // КОНФИГУРАЦИЯ
    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25';
    const BUTTON_ID = 'tm-inline-webhook-btn';
    const MODAL_ID = 'tm-modal-overlay';
    
    // Флаг создания кнопки (сбрасывается при переходе)
    let buttonCreated = false;

    // =================================================================
    // 1. УЛУЧШЕННАЯ ФУНКЦИЯ ОЖИДАНИЯ (как в рабочем примере)
    // =================================================================
    function waitForElement(selector, callback, maxRetries = 20) {
        let retries = 0;
        
        const check = () => {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
                return;
            }
            
            retries++;
            if (retries > maxRetries) {
                console.log('[AvitoScript] Элемент не найден после', maxRetries, 'попыток:', selector);
                return;
            }
            
            setTimeout(check, 300);
        };
        
        check();

        // Дублируем через Observer на случай динамической подгрузки
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

    // =================================================================
    // 2. СБОР ДАННЫХ СО СТРАНИЦЫ
    // =================================================================
    function collectParamsData() {
        const params = {};
        const labelEl = document.querySelector('[data-marker="modification-name/label"]');
        const modificationId = labelEl ? labelEl.textContent.replace('Модификация:', '').trim() : '';

        document.querySelectorAll('div[data-marker="modification/param"]').forEach(row => {
            const nameLink = row.querySelector('a[data-marker="modification/param-name-link"]');
            if (!nameLink) return;
            
            const paramName = nameLink.textContent.trim();
            const values = [];
            
            const valueLinks = row.querySelectorAll('a[data-marker="modification/value-name-link"]');
            if (valueLinks.length > 0) {
                valueLinks.forEach(link => {
                    const val = link.textContent.trim();
                    if (val) values.push(val);
                });
            } else {
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

    // =================================================================
    // 3. СОЗДАНИЕ КНОПКИ (как в рабочем примере)
    // =================================================================
    function createTriggerButton() {
        // Если кнопка уже создана - выходим
        if (document.getElementById(BUTTON_ID)) {
            return;
        }

        // Ищем целевой элемент (кнопку истории или лейбл)
        const target = document.querySelector('button[data-marker="modification-name/historyBtn"]') ||
                       document.querySelector('[data-marker="modification-name/label"]');

        if (!target || !target.parentElement) {
            // Пробуем позже
            setTimeout(createTriggerButton, 300);
            return;
        }

        buttonCreated = true;
        console.log('[AvitoScript] Создание кнопки...');

        const buttonContainer = document.createElement('div');
        buttonContainer.id = BUTTON_ID + '-container';
        buttonContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 8px;
            vertical-align: middle;
        `;

        const triggerButton = document.createElement('button');
        triggerButton.id = BUTTON_ID;
        triggerButton.type = 'button';
        triggerButton.textContent = '🚀 Автоклик';
        triggerButton.title = 'Собрать и отправить все параметры';
        
        triggerButton.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 4px 10px;
            height: auto;
            font-size: 12px;
            font-family: inherit;
            font-weight: bold;
            line-height: normal;
            color: #fff;
            background-color: #00aaff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
            box-sizing: border-box;
            outline: none;
            z-index: 9999;
        `;

        triggerButton.addEventListener('mouseenter', () => {
            triggerButton.style.backgroundColor = '#0099e6';
        });

        triggerButton.addEventListener('mouseleave', () => {
            triggerButton.style.backgroundColor = '#00aaff';
        });

        triggerButton.addEventListener('mousedown', () => {
            triggerButton.style.backgroundColor = '#0088cc';
        });

        triggerButton.addEventListener('mouseup', () => {
            triggerButton.style.backgroundColor = '#0099e6';
        });

        triggerButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openModal();
        });

        buttonContainer.appendChild(triggerButton);
        
        // Вставляем ПОСЛЕ целевого элемента
        target.parentElement.insertBefore(buttonContainer, target.nextSibling);
        console.log('[AvitoScript] Кнопка успешно добавлена');
    }

    // =================================================================
    // 4. МОДАЛЬНОЕ ОКНО (как в рабочем примере)
    // =================================================================
    function openModal() {
        if (document.getElementById(MODAL_ID)) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = MODAL_ID;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(3px);
            z-index: 2147483647;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #1e1e2e;
            color: #cdd6f4;
            border-radius: 12px;
            padding: 20px;
            width: 450px;
            max-width: 90%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            border: 1px solid #313244;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
        
        const title = document.createElement('h3');
        title.textContent = 'Отправка данных';
        title.style.cssText = `margin: 0; font-size: 15px; color: #cdd6f4;`;

        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `cursor: pointer; font-size: 18px; color: #a6adc8;`;
        closeBtn.onclick = closeModal;

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Input
        const textarea = document.createElement('textarea');
        textarea.id = 'tm-input';
        textarea.placeholder = 'Введите текст (или оставьте пустым для авто-сбора всех параметров)...';
        textarea.rows = 3;
        textarea.style.cssText = `
            width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px;
            background: #11111b; color: #cdd6f4; border: 1px solid #45475a;
            font-size: 13px; outline: none; resize: vertical; font-family: monospace;
        `;
        
        // Автозаполнение выделенным текстом
        const sel = window.getSelection().toString();
        if (sel) textarea.value = sel;

        // Response Area
        const responseContainer = document.createElement('div');
        responseContainer.id = 'tm-response-container';
        responseContainer.style.cssText = `display: none; flex-direction: column; gap: 6px;`;
        
        const responseLabel = document.createElement('span');
        responseLabel.textContent = '📥 Ответ сервера:';
        responseLabel.style.cssText = `font-size: 12px; font-weight: 600; color: #a6e3a1;`;

        const responseOutput = document.createElement('div');
        responseOutput.id = 'tm-response-output';
        responseOutput.style.cssText = `
            background: #11111b; border: 1px solid #45475a; border-radius: 8px;
            padding: 10px; font-size: 12px; color: #a6adc8; max-height: 250px;
            overflow-y: auto; white-space: pre-wrap; font-family: monospace;
        `;

        responseContainer.appendChild(responseLabel);
        responseContainer.appendChild(responseOutput);

        // Buttons
        const buttonsRow = document.createElement('div');
        buttonsRow.style.cssText = `display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;`;

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'tm-cancel';
        cancelBtn.textContent = 'Закрыть';
        cancelBtn.style.cssText = `
            padding: 6px 12px; border-radius: 6px; border: 1px solid #45475a; 
            background: transparent; color: #cdd6f4; cursor: pointer;
        `;
        cancelBtn.onclick = closeModal;

        const submitBtn = document.createElement('button');
        submitBtn.id = 'tm-submit';
        submitBtn.textContent = 'Отправить';
        submitBtn.style.cssText = `
            padding: 6px 16px; border-radius: 6px; border: none; 
            background: #89b4fa; color: #11111b; font-weight: 600; cursor: pointer;
        `;

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(submitBtn);

        // Сборка
        modal.appendChild(header);
        modal.appendChild(textarea);
        modal.appendChild(responseContainer);
        modal.appendChild(buttonsRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Логика отправки
        submitBtn.addEventListener('click', () => {
            const manualText = textarea.value.trim();
            
            submitBtn.disabled = true;
            submitBtn.innerText = '⏳ ...';
            responseContainer.style.display = 'flex';
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

            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(async (response) => {
                const textData = await response.text();
                
                if (response.ok) {
                    try {
                        const jsonData = JSON.parse(textData);
                        responseOutput.innerText = `✅ Успешно!\nПараметров: ${payload.params_count || 0}\n\nОтвет:\n` + 
                            JSON.stringify(jsonData, null, 2);
                    } catch (e) {
                        responseOutput.innerText = `✅ Успешно!\nПараметров: ${payload.params_count || 0}\n\nОтвет:\n${textData}`;
                    }
                } else {
                    responseOutput.innerText = `❌ Ошибка ${response.status}:\n${textData}`;
                }
            })
            .catch((error) => {
                responseOutput.innerText = `❌ Сетевая ошибка: ${error.message}`;
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Отправить';
            });
        });

        function closeModal() {
            overlay.remove();
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    // =================================================================
    // 5. ЛОГИКА ДЛЯ SPA (как в рабочем примере)
    // =================================================================
    
    function init() {
        console.log('[AvitoScript] Инициализация...');
        buttonCreated = false; // Сброс флага
        
        // Ждем появления элемента модификации
        waitForElement(
            'button[data-marker="modification-name/historyBtn"], [data-marker="modification-name/label"]', 
            createTriggerButton
        );
    }

    // Запуск при первой загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Отслеживание изменений URL (MutationObserver)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('[AvitoScript] URL изменился:', url);
            
            // Проверяем, что мы всё ещё на странице каталога
            if (url.startsWith('https://catalogs.avito.ru/catalog/') && url.includes('/modifications/')) {
                setTimeout(init, 300);
            }
        }
    });

    urlObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Перехват history API (pushState/replaceState)
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
        console.log('[AvitoScript] pushstate detected');
        setTimeout(() => {
            if (location.href.startsWith('https://catalogs.avito.ru/catalog/') && location.href.includes('/modifications/')) {
                init();
            }
        }, 300);
    });

    window.addEventListener('replacestate', () => {
        console.log('[AvitoScript] replacestate detected');
        setTimeout(() => {
            if (location.href.startsWith('https://catalogs.avito.ru/catalog/') && location.href.includes('/modifications/')) {
                init();
            }
        }, 300);
    });

    window.addEventListener('popstate', () => {
        console.log('[AvitoScript] popstate detected');
        setTimeout(() => {
            if (location.href.startsWith('https://catalogs.avito.ru/catalog/') && location.href.includes('/modifications/')) {
                init();
            }
        }, 300);
    });

})();
