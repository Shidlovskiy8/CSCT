// =================================================================
// МОНОЛИТНЫЙ СКРИПТ АВТОЗАПОЛНЕНИЯ И ИНЖЕКТА КНОПКИ (GITHUB MODULE)
// =================================================================

(function() {
    'use strict';

    // 🛑 Защита от повторного внедрения и исполнения скрипта
    if (window.__AUTOFILL_ENGINE_LOADED__) {
        console.warn('⚡ [Autofill Engine] Скрипт уже загружен на этой странице.');
        return;
    }
    window.__AUTOFILL_ENGINE_LOADED__ = true;

    window.TARGET_MAP = window.TARGET_MAP || {};
    window.ui = window.ui || null;
    window.isExecuting = window.isExecuting || false;
    var CACHE_TTL = 24 * 60 * 60 * 1000;

    // =================================================================
    // 1. БЛОКИРОВКА РУЧНОГО СКРОЛЛА (ScrollLock)
    // =================================================================
    window.ScrollLock = window.ScrollLock || class ScrollLock {
        static isLocked = false;
        static originalOverflow = '';

        static preventDefaultHandler(e) {
            if (e.target && e.target.closest('#autoclick-debug-ui')) return;
            e.preventDefault();
        }

        static preventKeysHandler(e) {
            if (e.target && e.target.closest('#autoclick-debug-ui')) return;
            if ([32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
        }

        static lock() {
            if (this.isLocked) return;
            this.isLocked = true;
            this.originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            window.addEventListener('wheel', this.preventDefaultHandler, { passive: false });
            window.addEventListener('touchmove', this.preventDefaultHandler, { passive: false });
            window.addEventListener('keydown', this.preventKeysHandler, { passive: false });
        }

        static unlock() {
            if (!this.isLocked) return;
            this.isLocked = false;
            document.body.style.overflow = this.originalOverflow;
            window.removeEventListener('wheel', this.preventDefaultHandler);
            window.removeEventListener('touchmove', this.preventDefaultHandler);
            window.removeEventListener('keydown', this.preventKeysHandler);
        }
    };

    // =================================================================
    // 2. ИНТЕРФЕЙС КЛИКЕРА (DebugUI)
    // =================================================================
    window.DebugUI = window.DebugUI || class DebugUI {
        constructor() {
            this.container = null;
            this.statusEl = null;
            this.logEl = null;
            this.fieldsEl = null;
            this.isCollapsed = false;
            this.init();
        }

        init() {
            if (document.getElementById('autoclick-debug-ui')) {
                this.container = document.getElementById('autoclick-debug-ui');
                this.statusEl = document.getElementById('ac-ui-status');
                this.logEl = document.getElementById('ac-ui-log');
                this.fieldsEl = document.getElementById('ac-ui-fields');
                return;
            }

            this.container = document.createElement('div');
            this.container.id = 'autoclick-debug-ui';
            this.container.style.cssText = `
                position: fixed; top: 0; right: 0; width: 360px; height: 100vh;
                background: #181825; color: #cdd6f4;
                font-family: "JetBrains Mono", "Consolas", monospace; font-size: 11px;
                box-shadow: -8px 0 24px rgba(0,0,0,0.3); border-left: 1px solid #313244;
                z-index: 999999; padding: 12px; box-sizing: border-box; line-height: 1.4;
                display: flex; flex-direction: column; gap: 8px; transition: transform 0.25s ease;
            `;

            this.container.innerHTML = `
                <div style="font-weight: 600; border-bottom: 1px solid #313244; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center; color: #89b4fa; flex-shrink: 0;">
                    <span>⚡ Автокликер <span style="font-size: 9px; opacity: 0.7;">v8.61</span></span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span id="ac-ui-status" style="font-size: 10px; background: #2a2b3d; padding: 2px 6px; border-radius: 4px; color: #f9e2af; border: 1px solid #45475a;">ГОТОВ</span>
                        <button id="ac-ui-toggle" style="background: #313244; color: #a6adc8; border: none; width: 20px; height: 20px; border-radius: 4px; cursor: pointer;">—</button>
                    </div>
                </div>
                <div id="ac-ui-content" style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
                    <div style="font-size: 10px; font-weight: 600; color: #a6adc8; flex-shrink: 0;">ЛОГ ДЕЙСТВИЙ:</div>
                    <div id="ac-ui-log" style="background: #11111b; padding: 8px; border-radius: 6px; flex: 1 1 60%; overflow-y: auto; color: #bac2de; font-size: 10px; border: 1px solid #1e1e2e; word-break: break-word;"></div>
                    <div style="font-size: 10px; font-weight: 600; color: #a6adc8; flex-shrink: 0;">ПЕРЕДАННЫЙ СТЕК ПАРАМЕТРОВ:</div>
                    <div id="ac-ui-fields" style="background: #11111b; padding: 8px; border-radius: 6px; flex: 1 1 40%; overflow-y: auto; color: #94e2d5; font-size: 10px; border: 1px solid #1e1e2e; word-break: break-word;">Ожидание...</div>
                </div>
            `;

            document.body.appendChild(this.container);
            this.statusEl = document.getElementById('ac-ui-status');
            this.logEl = document.getElementById('ac-ui-log');
            this.fieldsEl = document.getElementById('ac-ui-fields');

            const toggleBtn = document.getElementById('ac-ui-toggle');
            const contentEl = document.getElementById('ac-ui-content');
            toggleBtn.addEventListener('click', () => {
                this.isCollapsed = !this.isCollapsed;
                contentEl.style.display = this.isCollapsed ? 'none' : 'flex';
                this.container.style.height = this.isCollapsed ? 'auto' : '100vh';
                this.container.style.width = this.isCollapsed ? '230px' : '360px';
            });
        }

        setStatus(statusText, color = '#f9e2af') {
            if (this.statusEl) {
                this.statusEl.textContent = statusText;
                this.statusEl.style.color = color;
            }
        }

        log(msg, color = '#bac2de') {
            if (this.logEl) {
                const time = new Date().toLocaleTimeString();
                const line = document.createElement('div');
                line.style.color = color;
                line.style.marginBottom = '2px';
                line.innerHTML = `<span style="color:#585b70;">[${time}]</span> ${msg}`;
                this.logEl.appendChild(line);
                this.logEl.scrollTop = this.logEl.scrollHeight;
            }
        }

        setFields(fieldsArray) {
            if (!this.fieldsEl) return;
            if (!fieldsArray || fieldsArray.length === 0) {
                this.fieldsEl.innerHTML = '<i style="color:#f38ba8;">⚠️ Поля отсутствуют</i>';
                return;
            }
            let html = '';
            fieldsArray.forEach((f, idx) => {
                html += `<div style="margin-bottom: 3px;"><strong style="color: #cba6f7;">[${idx+1}. ${f.type}] ${f.name || 'Поле ' + (idx+1)}:</strong> <span style="color: #f9e2af;">${f.target || 'N/A'}</span> ➔ <span style="color: #a6e3a1;">"${f.value}"</span></div>`;
            });
            this.fieldsEl.innerHTML = html;
        }
    };

    // =================================================================
    // 3. НАДЕЖНЫЙ ИНЖЕКТОР КНОПКИ (Через MutationObserver)
    // =================================================================
    function injectCatalogButton() {
        if (window.location.href.includes('/additem')) return;

        // Ищем целевой контейнер или альтернативные заголовки на странице каталога
        const targetContainer = 
            document.querySelector('.styles-module-itemLabelWrapper-Kpmoc') || 
            document.querySelector('span[data-marker="modification/select-text"]')?.parentElement ||
            document.querySelector('h1[data-marker="header/title"]') ||
            document.querySelector('h1.title-info-title-text');

        if (targetContainer && !document.getElementById('ext-autoclick-btn')) {
            const btn = document.createElement('button');
            btn.id = 'ext-autoclick-btn';
            btn.type = 'button';
            btn.innerHTML = '🚀 Собрать подачу';
            btn.style.cssText = `
                margin-left: 10px;
                padding: 5px 12px;
                background: #00a550;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                box-shadow: 0 2px 5px rgba(0,0,0,0.15);
                vertical-align: middle;
                transition: background 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                z-index: 9999;
            `;

            btn.addEventListener('click', onCollectButtonClick);

            // Пытаемся встроить возле иконок или в конец контейнера
            const iconsBlock = targetContainer.querySelector('.styles-module-iconsBlock-gfM0R');
            if (iconsBlock) {
                iconsBlock.insertAdjacentElement('afterend', btn);
            } else {
                targetContainer.appendChild(btn);
            }
        }
    }

    function onCollectButtonClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const catalogSpan = document.querySelector('span.styles-module-size_s-e9rn2') || 
                            document.querySelector('span[data-marker="modification/select-text"]') || 
                            document.querySelector('h1');

        const catalogText = catalogSpan ? catalogSpan.textContent.trim() : null;
        if (!catalogText) return alert('Каталог не найден на странице');

        let fieldsConfig = [];
        try {
            const cached = JSON.parse(localStorage.getItem('avito_autoclick_cache') || '{}');
            fieldsConfig = cached.fields || [];
        } catch (err) {}

        const catalogTextNorm = catalogText.toLowerCase().trim();
        let dynamicValues = [];

        fieldsConfig.forEach(cfg => {
            const cat = (cfg.Catalog || cfg.catalog || '').toLowerCase().trim();
            if (cat && (catalogTextNorm.includes(cat) || cat.includes(catalogTextNorm))) {
                dynamicValues.push({
                    name: cfg.value,
                    type: cfg.value_type || "list",
                    target: cfg.value_front_target || cfg.value,
                    value: cfg.default_value || "",
                    default_value: cfg.default_value
                });
            }
        });

        chrome.storage.local.set({
            ac_selected_catalog: catalogText,
            ac_extracted_fields: JSON.stringify(dynamicValues),
            pendingFieldsStack: dynamicValues,
            ac_autoclick_active: true
        }, () => {
            window.open('https://www.avito.ru/additem', '_blank');
        });
    }

    // =================================================================
    // 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ПАЙПЛАЙН АВТОКЛИКА
    // =================================================================
    function normalizeText(text) {
        if (!text) return "";
        return String(text).replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/[—–-]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function parseTargetText(rawText) {
        if (!rawText) return "";
        let str = String(rawText).trim();
        if (str.includes('<') && str.includes('>')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = str;
            str = tempDiv.textContent.trim();
        }
        return str.replace(/^["']|["']$/g, '').trim();
    }

    function extractParamName(htmlString) {
        if (!htmlString) return null;
        const match = String(htmlString).match(/(?:id|name|marker|data-marker)=["']([^"']+)["']/i);
        return (match && match[1]) ? match[1].replace('/input', '').trim() : parseTargetText(htmlString) || null;
    }

    function resolveTarget(rawName) {
        if (!rawName) return "";
        const clean = parseTargetText(rawName);
        return window.TARGET_MAP[clean.toLowerCase()] || clean;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function cleanForMatching(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/ё/g, 'е').replace(/[()–—]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function fetchTableData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['avito_autoclick_cache', 'avito_autoclick_time'], (storage) => {
                const cachedData = storage.avito_autoclick_cache;
                const cachedTime = storage.avito_autoclick_time;
                if (cachedData && cachedTime && (Date.now() - cachedTime < CACHE_TTL)) {
                    try {
                        resolve(typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData);
                        return;
                    } catch (e) {}
                }
                resolve({ route: [], fields: [] });
            });
        });
    }

    function waitForFieldReady(findFn, timeout = 2500) {
        return new Promise((resolve) => {
            const interval = 50;
            let elapsed = 0;
            let lastRect = null;
            let stableFrames = 0;

            const timer = setInterval(() => {
                const el = findFn();
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
                    if (isVisible && !el.hasAttribute('disabled')) {
                        if (lastRect && lastRect.top === rect.top && lastRect.left === rect.left) stableFrames++;
                        else stableFrames = 0;
                        lastRect = rect;
                        if (stableFrames >= 2) {
                            clearInterval(timer);
                            return resolve(el);
                        }
                    }
                }
                elapsed += interval;
                if (elapsed >= timeout) {
                    clearInterval(timer);
                    resolve(findFn() || null);
                }
            }, interval);
        });
    }

    async function triggerFullClick(element) {
        if (!element) return;
        try {
            element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            await sleep(20);
            element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            element.click();
        } catch (e) {
            if (typeof element.click === 'function') element.click();
        }
    }

    async function safeResetDropdownState() {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        document.body.click();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        await sleep(50);
    }

    function setNativeValue(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

        if (prototypeValueSetter && valueSetter !== prototypeValueSetter) prototypeValueSetter.call(element, value);
        else if (valueSetter) valueSetter.call(element, value);
        else element.value = value;

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findBestMatchingOption(items, targetValue) {
        const targetNorm = normalizeText(targetValue);
        let exact = items.find(el => normalizeText(el.innerText || el.textContent) === targetNorm);
        if (exact) return exact;

        const tokens = targetNorm.replace(/[()]/g, ' ').split(/\s+/).filter(t => t.length > 0);
        if (tokens.length === 0) return null;

        let bestItem = null;
        let maxScore = 0;
        items.forEach(el => {
            const itemTxt = normalizeText(el.innerText || el.textContent);
            let score = 0;
            tokens.forEach(tok => { if (itemTxt.includes(tok)) score += 1; });
            if (score > maxScore) {
                maxScore = score;
                bestItem = el;
            }
        });

        return maxScore >= Math.ceil(tokens.length / 2) ? bestItem : null;
    }

    async function fillFormField(field) {
        const { type, target, value, name, default_value, targetValue } = field;
        const targetClean = extractParamName(target) || name;

        let valClean = targetValue || parseTargetText(value);
        if (!valClean && default_value) valClean = parseTargetText(default_value) || String(default_value).trim();
        if (!valClean) return false;

        await safeResetDropdownState();

        const isDropdownType = type === 'dropdown' || (name && (name.toLowerCase().includes('модификац') || name.toLowerCase().includes('комплектац') || name.toLowerCase().includes('тип')));

        if (isDropdownType) {
            const fieldContainer = await waitForFieldReady(() => {
                let foundEl = null;
                if (targetClean) {
                    const match = document.querySelector(`[data-marker*="${targetClean}"], [name*="${targetClean}"], [id*="${targetClean}"]`);
                    if (match) foundEl = match.closest('[class*="field"], [class*="select"], [role="combobox"], [class*="root"]') || match.parentElement;
                }
                return foundEl;
            }, 3000);

            if (!fieldContainer) {
                window.ui.log(`❌ Поле "${name}" (${targetClean}) не найдено`, '#ff5555');
                return false;
            }

            fieldContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(150);

            const clickTarget = fieldContainer.querySelector('[class*="selectWrapper"], [class*="selectSpan"], [data-marker*="select-text"], button, [role="combobox"]') || fieldContainer;
            if (typeof clickTarget.focus === 'function') clickTarget.focus();
            await triggerFullClick(clickTarget);
            await sleep(200);

            const targetOption = await waitForFieldReady(() => {
                const options = Array.from(document.querySelectorAll('[data-marker*="custom-option"], [data-marker*="option"], [role="option"], [role="checkbox"], div[class*="textWrapper"], div[class*="suggest-item"], li'));
                return findBestMatchingOption(options.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0), valClean);
            }, 2000);

            if (targetOption) {
                targetOption.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                await sleep(50);
                await triggerFullClick(targetOption);
                window.ui.log(`🎯 [Dropdown] Выбран пункт: "${targetOption.textContent.trim()}"`, '#50fa7b');
                await safeResetDropdownState();
                return true;
            } else {
                window.ui.log(`❌ [Dropdown] Вариант "${valClean}" не найден`, '#ff5555');
                await safeResetDropdownState();
                return false;
            }
        }

        const isRadioType = type === 'radio' || type === 'button' || (typeof target === 'string' && target.toLowerCase().includes('radio'));

        if (isRadioType) {
            const targetRadioLabel = await waitForFieldReady(() => {
                let scope = document;
                if (targetClean) {
                    const container = document.querySelector(`[data-marker*="${targetClean}"], [class*="${targetClean}"]`);
                    if (container) scope = container;
                }
                const candidates = Array.from(scope.querySelectorAll('[role="button"], [role="radio"], label, button, [class*="option-j5fd8"], [class*="item-item"], [class*="chip"], [class*="card"]'));
                const targetNormalized = cleanForMatching(valClean).replace(/ё/g, 'е');
                
                return candidates.find(el => {
                    const directText = cleanForMatching(el.innerText || el.textContent).replace(/ё/g, 'е');
                    return directText === targetNormalized;
                });
            }, 2500);

            if (targetRadioLabel) {
                targetRadioLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(100);
                const clickTarget = targetRadioLabel.querySelector('p, span, img, label') || targetRadioLabel;
                await triggerFullClick(clickTarget);
                window.ui.log(`🎯 Выбран вариант: "${valClean}"`, '#50fa7b');
                return true;
            }
        }

        if (!targetClean) return false;

        const input = await waitForFieldReady(() => {
            return document.querySelector(`input[data-marker*="${targetClean}"]`) ||
                   document.querySelector(`input[id="${targetClean}"]`) ||
                   document.querySelector(`input[name*="${targetClean}"]`);
        }, 2000);

        if (!input) return false;

        const labelContainer = input.closest('label') || input.closest('div[class*="select"]') || input;
        labelContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);

        await triggerFullClick(labelContainer);
        input.focus();
        setNativeValue(input, valClean);
        await sleep(150);

        return true;
    }

    async function runAutoClickerPipeline(fieldsStack) {
        if (window.isExecuting) return;
        window.isExecuting = true;

        if (!window.ui) window.ui = new window.DebugUI();
        window.ui.setStatus('В РАБОТЕ', '#f9e2af');
        window.ui.log('🏁 Запуск автозаполнения полей...', '#89b4fa');
        
        window.ScrollLock.lock();

        try {
            const dbData = await fetchTableData();
            if (dbData && dbData.fields) {
                dbData.fields.forEach(f => {
                    const targetKey = parseTargetText(f.target || f.name).toLowerCase();
                    const sourceKey = parseTargetText(f.name || f.target).toLowerCase();
                    if (targetKey && sourceKey) window.TARGET_MAP[sourceKey] = targetKey;
                });
            }

            let processedFields = (fieldsStack || []).map(item => ({
                ...item,
                target: resolveTarget(item.target || item.name),
                targetValue: item.value || item.targetValue || item.default_value
            }));

            window.ui.setFields(processedFields);

            if (processedFields.length === 0) {
                window.ui.log('⚠️ Стек параметров пуст.', '#ffb86c');
                window.ui.setStatus('ОШИБКА', '#ff5555');
                return;
            }

            let successCount = 0;
            for (let i = 0; i < processedFields.length; i++) {
                const field = processedFields[i];
                window.ui.log(`⏳ [${i + 1}/${processedFields.length}] Поле: "${field.name || field.target}"...`, '#cdd6f4');
                const result = await fillFormField(field);
                if (result) successCount++;
                await sleep(250);
            }

            window.ui.log(`🎉 Успешно заполнено: ${successCount} из ${processedFields.length}`, '#50fa7b');
            window.ui.setStatus('ГОТОВО', '#50fa7b');

        } catch (err) {
            window.ui.log(`💥 Ошибка: ${err.message}`, '#ff5555');
            window.ui.setStatus('СБОЙ', '#ff5555');
        } finally {
            window.ScrollLock.unlock();
            window.isExecuting = false;
        }
    }

    // =================================================================
    // 5. ИНИЦИАЛИЗАЦИЯ НАБЛЮДАТЕЛЯ DOM
    // =================================================================
    const observer = new MutationObserver(injectCatalogButton);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    injectCatalogButton();

    if (window.location.href.includes('/additem')) {
        const mountUI = () => {
            if (!window.ui) {
                window.ui = new window.DebugUI();
                window.ui.log('💡 Автокликер готов к работе на странице подачи.', '#89b4fa');
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mountUI);
        } else {
            mountUI();
        }

        chrome.storage.local.get(['pendingFieldsStack', 'ac_autoclick_active'], (data) => {
            if (data.ac_autoclick_active && data.pendingFieldsStack && data.pendingFieldsStack.length > 0) {
                chrome.storage.local.set({ ac_autoclick_active: false });
                runAutoClickerPipeline(data.pendingFieldsStack);
            }
        });
    }
})();
