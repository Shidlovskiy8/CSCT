(function () {
    'use strict';

    // -----------------------------------------------------------------
    // КОНФИГУРАЦИЯ GOOGLE SHEETS API
    // -----------------------------------------------------------------
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec';
    const STORAGE_CACHE_KEY = 'gs_fields_config';

    // -----------------------------------------------------------------
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // -----------------------------------------------------------------
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function normalizeText(text) {
        return (text || '')
            .toString()
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function cleanForMatching(text) {
        return normalizeText(text).replace(/[^a-zа-я0-9]/gi, '');
    }

    function extractParamName(target) {
        if (!target) return null;
        const match = target.match(/params\[(.*?)\]/);
        return match ? match[1] : target;
    }

    function parseTargetText(text) {
        if (!text) return '';
        return String(text).replace(/^«|»$/g, '').replace(/^"|"$/g, '').trim();
    }

    function triggerFullClick(element) {
        if (!element) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((eventType) => {
            element.dispatchEvent(
                new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window
                })
            );
        });
    }

    function setNativeValue(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

        if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else if (valueSetter) {
            valueSetter.call(element, value);
        } else {
            element.value = value;
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function safeResetDropdownState() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        await sleep(50);
    }

    async function waitForFieldReady(predicate, timeout = 2500, interval = 100) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const result = predicate();
            if (result) return result;
            await sleep(interval);
        }
        return null;
    }

    function findBestMatchingOption(options, targetValue) {
        const normTarget = cleanForMatching(targetValue);
        const targetYears = normTarget.match(/\d{4}/g) || [];

        return options.find((opt) => {
            const normOpt = cleanForMatching(opt.textContent);
            if (normOpt === normTarget) return true;

            if (targetYears.length > 0) {
                const optYears = normOpt.match(/\d{4}/g) || [];
                if (targetYears.some((y) => optYears.includes(y))) {
                    const needsRestyle = normTarget.includes('рестайлинг');
                    const hasRestyle = normOpt.includes('рестайлинг');
                    return needsRestyle === hasRestyle;
                }
            }
            return false;
        });
    }

    // -----------------------------------------------------------------
    // ИНТЕГРАЦИЯ С GOOGLE SHEETS API
    // -----------------------------------------------------------------
    async function fetchTableData(forceRefresh = false) {
        const cached = localStorage.getItem(STORAGE_CACHE_KEY);
        if (cached && !forceRefresh) {
            ui.log('📦 Данные извлечены из локального кэша', '#89b4fa');
            return JSON.parse(cached);
        }

        ui.log('⏳ Запрос конфигурации из Google Sheets...', '#f9e2af');
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getFieldsConfig`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
            ui.log('✅ Данные из Google Sheets успешно обновлены', '#a6e3a1');
            return data;
        } catch (err) {
            ui.log(`❌ Ошибка запроса к Google Sheets: ${err.message}`, '#f38ba8');
            throw err;
        }
    }

    // -----------------------------------------------------------------
    // ПАРСЕР ВХОДЯЩЕГО ТЕКСТА
    // -----------------------------------------------------------------
    function parseRawInputText(rawText) {
        const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
        const parsedFields = [];

        for (const line of lines) {
            const typeMatch = line.match(/\[\d+\.\s*(\w+)\]/);
            const extractedType = typeMatch ? typeMatch[1].toLowerCase() : null;

            const nameMatch = line.match(/^(?:\[.*?\]\s*)?([^:]+):/);
            const fieldName = nameMatch ? nameMatch[1].trim() : '';

            const targetMatch = line.match(/(params\[[^\]]+\](?:\/\w+)?)/);
            const target = targetMatch ? targetMatch[1] : fieldName;

            const valMatch = line.match(/[➔=:]\s*["«']?(.*?)["»']?$/);
            const valClean = valMatch ? valMatch[1].replace(/["«»]/g, '').trim() : '';

            if (target || fieldName) {
                parsedFields.push({
                    name: fieldName,
                    target: target,
                    type: extractedType || 'list',
                    value: valClean,
                    targetValue: valClean
                });
            }
        }

        return parsedFields;
    }

    // -----------------------------------------------------------------
    // МОДУЛЬ ЗАПОЛНЕНИЯ ПОЛЯ
    // -----------------------------------------------------------------
    async function fillFormField(field) {
        const { type, target, value, name, default_value, targetValue } = field;
        const targetClean = extractParamName(target) || name;

        let valClean = targetValue || parseTargetText(value);
        if (!valClean && default_value) {
            valClean = parseTargetText(default_value) || String(default_value).trim();
        }

        if (!valClean) return false;
        await safeResetDropdownState();

        // 1. РАДИОКНОПКИ / КНОПКИ
        const fieldContainerElement = targetClean
            ? document.querySelector(`[data-marker*="${targetClean}"], [class*="${targetClean}"]`)
            : null;

        const hasRadioInDom = fieldContainerElement
            ? Boolean(fieldContainerElement.querySelector('[role="radio"], input[type="radio"]'))
            : false;

        const isRadioType =
            type === 'radio' ||
            type === 'button' ||
            hasRadioInDom ||
            (typeof target === 'string' && target.toLowerCase().includes('radio')) ||
            (name && (name.toLowerCase().includes('фаз') || name.toLowerCase().includes('счетчик')));

        if (isRadioType) {
            const targetRadioLabel = await waitForFieldReady(() => {
                let scope = document;
                if (targetClean) {
                    const container = document.querySelector(`[data-marker*="${targetClean}"], [class*="${targetClean}"]`);
                    if (container) scope = container;
                }

                if (targetClean || valClean) {
                    const exactMatch = scope.querySelector(`
                        [data-marker*="${targetClean}/${valClean}"],
                        [data-marker$="/${valClean}"],
                        input[value="${valClean}"]
                    `);
                    if (exactMatch) {
                        const label = exactMatch.closest('label, [role="radio"]') || exactMatch.parentElement;
                        if (label) return label;
                    }
                }

                const candidates = Array.from(
                    scope.querySelectorAll(
                        '[role="button"], [role="radio"], label, button, [class*="option-j5fd8"], [class*="item-item"], [class*="chip"], [class*="card"]'
                    )
                );

                const targetNormalized = cleanForMatching(valClean).replace(/ё/g, 'е');
                const targetYears = targetNormalized.match(/\d{4}/g) || [];

                return candidates.find((el) => {
                    if (el.offsetWidth > 700 || el.offsetHeight > 500) return false;

                    const directText = cleanForMatching(el.innerText || el.textContent).replace(/ё/g, 'е');
                    if (!directText) return false;

                    if (directText === targetNormalized) return true;

                    const subLabels = Array.from(el.querySelectorAll('p, span, div'));
                    if (subLabels.some((sub) => cleanForMatching(sub.textContent).replace(/ё/g, 'е') === targetNormalized)) {
                        return true;
                    }

                    if (targetYears.length > 0) {
                        const candidateYears = directText.match(/\d{4}/g) || [];
                        const hasYearMatch = targetYears.some((y) => candidateYears.includes(y));

                        if (hasYearMatch) {
                            const needsRestyle = targetNormalized.includes('рестайлинг');
                            const hasRestyle = directText.includes('рестайлинг');
                            if (needsRestyle === hasRestyle) return true;
                        }
                    }

                    return false;
                });
            }, 2500);

            if (targetRadioLabel) {
                targetRadioLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(100);

                const textElement = Array.from(targetRadioLabel.querySelectorAll('div, span, p')).find(
                    (el) => cleanForMatching(el.textContent).replace(/ё/g, 'е') === cleanForMatching(valClean).replace(/ё/g, 'е')
                );

                const inputEl = targetRadioLabel.querySelector('input');
                if (inputEl) {
                    inputEl.click();
                    inputEl.checked = true;
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const clickTarget = textElement || targetRadioLabel.querySelector('[class*="VExVt"]') || targetRadioLabel;
                await triggerFullClick(clickTarget);

                await sleep(50);
                ui.log(`🎯 Выбрана радиокнопка: "${valClean}"`, '#a6e3a1');
                return true;
            } else if (type === 'radio' || type === 'button') {
                ui.log(`⚠️ [Radio/Button] Вариант "${valClean}" не найден, проба как input...`, '#f9e2af');
            }
        }

        // 2. ВЫПАДАЮЩИЕ СПИСКИ (Dropdown)
        const isDropdownType =
            type === 'dropdown' ||
            (name && (name.toLowerCase().includes('модификац') || name.toLowerCase().includes('комплектац')));

        if (isDropdownType) {
            const fieldContainer = await waitForFieldReady(() => {
                let foundEl = null;

                if (targetClean) {
                    const selector = `[data-marker*="${targetClean}"], [name*="${targetClean}"], [id*="${targetClean}"]`;
                    const match = document.querySelector(selector);
                    if (match) {
                        foundEl = match.closest('[class*="field"], [class*="select"], [role="combobox"], [class*="root"]') || match.parentElement;
                    }
                }

                if (!foundEl && name) {
                    const allLabels = Array.from(document.querySelectorAll('div, label, span, p'));
                    const labelMatch = allLabels.find((el) => {
                        const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
                        return text === name.toLowerCase();
                    });

                    if (labelMatch) {
                        foundEl =
                            labelMatch.closest('[class*="field"], [class*="select"], [role="combobox"], [class*="root"]') ||
                            labelMatch.parentElement?.querySelector('[role="combobox"], [class*="select"]');
                    }
                }

                if (!foundEl && targetClean) {
                    const matches = Array.from(document.querySelectorAll('[role="combobox"]'));
                    for (let el of matches) {
                        if ((el.textContent || '').toLowerCase().includes(name.toLowerCase())) {
                            foundEl = el;
                            break;
                        }
                    }
                }

                return foundEl;
            }, 3000);

            if (!fieldContainer) {
                ui.log(`❌ Поле "${name}" (${targetClean}) не найдено`, '#f38ba8');
                return false;
            }

            fieldContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(150);

            const clickTarget =
                fieldContainer.querySelector('[class*="selectWrapper"], [class*="selectSpan"], [data-marker*="select-text"], button, [role="combobox"]') ||
                fieldContainer;

            if (typeof clickTarget.focus === 'function') clickTarget.focus();
            await triggerFullClick(clickTarget);
            await sleep(200);

            const targetOption = await waitForFieldReady(() => {
                const options = Array.from(
                    document.querySelectorAll(
                        '[data-marker*="custom-option"], [data-marker*="option"], [role="option"], [role="checkbox"], div[class*="textWrapper"], div[class*="suggest-item"], li'
                    )
                );
                const visibleOptions = options.filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0);
                return findBestMatchingOption(visibleOptions, valClean);
            }, 2000);

            if (targetOption) {
                targetOption.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                await sleep(50);
                await triggerFullClick(targetOption);
                ui.log(`🎯 [Dropdown] Выбран пункт: "${targetOption.textContent.trim()}"`, '#a6e3a1');
                await safeResetDropdownState();
                return true;
            } else {
                ui.log(`❌ [Dropdown] Вариант "${valClean}" не найден в списке "${name}"`, '#f38ba8');
                await safeResetDropdownState();
                return false;
            }
        }

        // 3. ТЕКСТОВЫЕ ВВОДЫ (Input / Suggest / List)
        if (!targetClean) return false;

        const input = await waitForFieldReady(() => {
            return (
                document.querySelector(`input[data-marker*="${targetClean}"]`) ||
                document.querySelector(`input[id="${targetClean}"]`) ||
                document.querySelector(`input[name*="${targetClean}"]`)
            );
        }, 2000);

        if (!input) {
            ui.log(`❌ Текстовое поле "${targetClean}" не найдено в DOM`, '#f38ba8');
            return false;
        }

        const currentValue = normalizeText(input.value);
        if (currentValue === normalizeText(valClean)) {
            ui.log(`ℹ️ Поле "${targetClean}" уже содержит значение "${valClean}". Пропуск.`, '#89b4fa');
            return true;
        }

        const labelContainer = input.closest('label') || input.closest('div[class*="select"]') || input;
        labelContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);

        await triggerFullClick(labelContainer);
        input.focus();
        await triggerFullClick(input);
        await sleep(50);

        setNativeValue(input, valClean);
        await sleep(150);

        if (type === 'list' || type === 'suggest') {
            const targetOption = await waitForFieldReady(() => {
                const items = Array.from(document.querySelectorAll('[data-marker*="option"], [role="option"], li, div[class*="suggest-item"]'));
                const visibleItems = items.filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0);
                return findBestMatchingOption(visibleItems, valClean);
            }, 1500);

            if (targetOption) {
                targetOption.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                await sleep(30);
                await triggerFullClick(targetOption);
                ui.log(`🎯 Выбран пункт подсказки: "${targetOption.textContent.trim()}"`, '#a6e3a1');
            } else {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                ui.log(`⚠️ Вариант в списке не найден, отправлен Enter: "${valClean}"`, '#f9e2af');
            }

            await sleep(50);
            await safeResetDropdownState();
        }

        return true;
    }

    // -----------------------------------------------------------------
    // ОСНОВНОЙ СЦЕНАРИЙ ИСПОЛНЕНИЯ
    // -----------------------------------------------------------------
    async function processManualInput(rawText) {
        if (!rawText || !rawText.trim()) {
            ui.log('⚠️ Поле ввода пустое. Вставьте данные.', '#f38ba8');
            return;
        }

        const fieldsToFill = parseRawInputText(rawText);
        ui.log(`📊 Распознано полей для заполнения: ${fieldsToFill.length}`, '#89b4fa');

        let gsConfig = [];
        try {
            const tableData = await fetchTableData();
            gsConfig = tableData.fields || tableData;
        } catch (e) {
            ui.log('⚠️ Работаем без сопоставления конфигурации Google Sheets.', '#f9e2af');
        }

        fieldsToFill.forEach((field) => {
            if (gsConfig.length > 0) {
                const cfgMatch = gsConfig.find(
                    (c) => normalizeText(c.value_front_target) === normalizeText(field.target) || normalizeText(c.value) === normalizeText(field.name)
                );
                if (cfgMatch) {
                    if (cfgMatch.value_type) field.type = cfgMatch.value_type;
                }
            }
        });

        for (const field of fieldsToFill) {
            ui.log(`⏳ Заполнение "${field.name}" -> ${field.targetValue}...`, '#cdd6f4');
            const success = await fillFormField(field);
            if (!success) {
                ui.log(`❌ Пропуск или ошибка на поле "${field.name}"`, '#f38ba8');
            }
            await sleep(300);
        }

        ui.log('🎉 Все поля обработаны!', '#a6e3a1');
    }

    // -----------------------------------------------------------------
    // ИНТЕРФЕЙС (Плавающая кнопка + Модальное окно)
    // -----------------------------------------------------------------
    const ui = {
        triggerBtn: null,
        modalOverlay: null,
        logContainer: null,

        init() {
            if (document.getElementById('ac-trigger-btn')) return;

            // 1. Создаем маленькую аккуратную кнопку
            const btn = document.createElement('button');
            btn.id = 'ac-trigger-btn';
            btn.type = 'button';
            btn.innerHTML = '⚡ Автозаполнение';
            btn.style.cssText = `
                position: fixed !important; bottom: 25px !important; right: 25px !important; z-index: 2147483646 !important;
                background: #89b4fa !important; color: #11111b !important; border: none !important;
                border-radius: 50px !important; padding: 12px 20px !important; font-family: sans-serif !important;
                font-weight: bold !important; font-size: 13px !important; cursor: pointer !important;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important; transition: transform 0.2s, background 0.2s !important;
            `;

            btn.onmouseover = () => (btn.style.transform = 'scale(1.05)');
            btn.onmouseout = () => (btn.style.transform = 'scale(1)');
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openModal();
            };

            document.body.appendChild(btn);
            this.triggerBtn = btn;

            // 2. Создаем модальное окно (изначально скрыто)
            const overlay = document.createElement('div');
            overlay.id = 'ac-modal-overlay';
            overlay.style.cssText = `
                display: none; position: fixed !important; top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 100vh !important; background: rgba(0,0,0,0.6) !important;
                backdrop-filter: blur(3px) !important; z-index: 2147483647 !important;
                justify-content: center !important; align-items: center !important;
            `;

            overlay.innerHTML = `
                <div style="background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 12px; padding: 16px; width: 440px; max-width: 90vw; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: monospace; font-size: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <b style="color:#89b4fa; font-size:15px;">🚀 Автозаполнение Avito</b>
                        <button id="ac-modal-close" type="button" style="background:none; border:none; color:#f38ba8; cursor:pointer; font-size:18px;">✖</button>
                    </div>
                    <textarea id="ac-modal-text" rows="8" placeholder="Вставьте скопированные данные сюда..." style="width:100%; background:#11111b; color:#a6adc8; border:1px solid #313244; border-radius:6px; padding:8px; box-sizing:border-box; resize:vertical; font-size:11px; outline:none;"></textarea>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button id="ac-modal-start" type="button" style="flex:2; background:#a6e3a1; color:#11111b; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">▶ Запустить</button>
                        <button id="ac-modal-sync" type="button" style="flex:1; background:#89b4fa; color:#11111b; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">🔄 БД GS</button>
                    </div>
                    <div id="ac-modal-log" style="margin-top:10px; max-height:120px; overflow-y:auto; background:#11111b; padding:8px; border-radius:6px; border:1px solid #313244; font-size:10px; display:none;"></div>
                </div>
            `;

            document.body.appendChild(overlay);
            this.modalOverlay = overlay;
            this.logContainer = overlay.querySelector('#ac-modal-log');

            // Блокируем клики сквозь окно
            const prevent = (e) => e.stopPropagation();
            overlay.addEventListener('click', prevent, true);
            overlay.addEventListener('mousedown', prevent, true);

            // Навешиваем события на элементы модалки
            overlay.querySelector('#ac-modal-close').onclick = () => this.closeModal();
            overlay.onclick = (e) => {
                if (e.target === overlay) this.closeModal();
            };

            overlay.querySelector('#ac-modal-start').onclick = () => {
                const text = overlay.querySelector('#ac-modal-text').value;
                this.logContainer.style.display = 'block';
                processManualInput(text);
            };

            overlay.querySelector('#ac-modal-sync').onclick = () => {
                this.logContainer.style.display = 'block';
                fetchTableData(true);
            };
        },

        openModal() {
            if (this.modalOverlay) {
                this.modalOverlay.style.display = 'flex';
                const textarea = this.modalOverlay.querySelector('#ac-modal-text');
                if (textarea) textarea.focus();
            }
        },

        closeModal() {
            if (this.modalOverlay) {
                this.modalOverlay.style.display = 'none';
            }
        },

        log(msg, color = '#cdd6f4') {
            if (!this.logContainer) return;
            const item = document.createElement('div');
            item.style.color = color;
            item.style.marginBottom = '2px';
            item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            this.logContainer.appendChild(item);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    };

    // -----------------------------------------------------------------
    // ИНИЦИАЛИЗАЦИЯ
    // -----------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ui.init());
    } else {
        ui.init();
    }
})();
