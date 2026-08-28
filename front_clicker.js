(function() {
    'use strict';

    // ПРОВЕРКА URL: Работаем на всех каталогах, где есть /modifications/
    if (!window.location.href.startsWith('https://catalogs.avito.ru/catalog/')) {
        return;
    }
    if (!window.location.href.includes('/modifications/')) {
        return;
    }

    // Защита от дублей
    if (window.__searchIdScriptInjected) return;
    window.__searchIdScriptInjected = true;

    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25';
    const BUTTON_ID = 'tm-inline-webhook-btn';

    console.log('🚀 [AvitoScript] Запуск скрипта сбора параметров...');

    // 1. СОЗДАНИЕ КНОПКИ (Стиль "Автоклик" + иконка из вашего примера)
    function createInlineButton() {
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.textContent = '🚀 Автоклик';
        btn.title = 'Собрать и отправить все параметры';
        
        // Стили кнопки-текста (как в рабочем примере)
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
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: background-color 0.2s;
        `;

        // Добавим маленькую иконку внутри для красоты
        btn.innerHTML += `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        `;

        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#0099e6');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#00aaff');

        return btn;
    }

    // 2. СБОР ДАННЫХ (Автоматически со страницы)
    function collectAllParams() {
        const params = {};
        const labelEl = document.querySelector('[data-marker="modification-name/label"]');
        const modificationId = labelEl ? labelEl.textContent.replace('Модификация:', '').trim() : '';

        // Проходим по всем строкам параметров
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

    // 3. ОБРАБОТЧИК КЛИКА
    async function handleButtonClick() {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ Отправка...';
        btn.style.opacity = '0.7';

        try {
            // Собираем данные
            const data = collectAllParams();
            console.log('📦 Собранные данные:', data);

            if (data.params_count === 0) {
                alert('⚠️ Не удалось найти параметры на странице!');
                return;
            }

            // Отправляем
            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const text = await res.text();
            
            if (res.ok) {
                alert(`✅ Успешно!\n\nОтправлено параметров: ${data.params_count}\nМодификация: ${data.modification_id}\n\nОтвет сервера:\n${text}`);
            } else {
                alert(`❌ Ошибка ${res.status}:\n${text}`);
            }
        } catch (err) {
            alert(`❌ Сетевая ошибка: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.style.opacity = '1';
        }
    }

    // 4. ВСТРАИВАНИЕ КНОПКИ (ВАШ РАБОЧИЙ МЕХАНИЗМ)
    function injectButton() {
        // Ищем конкретный контейнер, который работает на странице /params
        // Пробуем несколько селекторов на всякий случай
        const targetContainer = document.querySelector('.styles-module-itemLabelWrapper-Kpmoc') || 
                                document.querySelector('[data-marker="modification-name/label"]')?.closest('div');

        if (targetContainer && !document.getElementById(BUTTON_ID)) {
            const btn = createInlineButton();
            btn.addEventListener('click', handleButtonClick);

            // Ищем блок иконок, чтобы встать после него (как в вашем примере)
            const iconsBlock = targetContainer.querySelector('.styles-module-iconsBlock-gfM0R') ||
                               targetContainer.querySelector('button[data-marker="modification-name/historyBtn"]');

            if (iconsBlock) {
                iconsBlock.insertAdjacentElement('afterend', btn);
            } else {
                targetContainer.appendChild(btn);
            }
            
            console.log('✅ Кнопка добавлена в DOM');
        }
    }

    // 5. ЗАПУСК
    // Добавляем слушатель на body (на случай если контейнер перерисуется)
    const observer = new MutationObserver(injectButton);
    
    // Ждем загрузки тела
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        // Первая попытка сразу
        setTimeout(injectButton, 100);
        setTimeout(injectButton, 500);
        setTimeout(injectButton, 1500);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
            injectButton();
        });
    }
})();
