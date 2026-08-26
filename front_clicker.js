/**
 * Avito Front AutoClicker (Pure Vanilla JS)
 */
(function() {
    'use strict';

    const TARGET_MAP = {};

    // =================================================================
    // МОДУЛЬ БЛОКИРОВКИ РУЧНОГО СКРОЛЛА
    // =================================================================
    class ScrollLock {
        static isLocked = false;
        static originalOverflow = '';

        static preventDefaultHandler(e) {
            if (e.target && e.target.closest('#autoclick-debug-ui')) return;
            e.preventDefault();
        }

        static preventKeysHandler(e) {
            if (e.target && e.target.closest('#autoclick-debug-ui')) return;
            const keys = [32, 33, 34, 35, 36, 37, 38, 39, 40];
            if (keys.includes(e.keyCode)) e.preventDefault();
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
    }

    // =================================================================
    // ВИЗУАЛЬНАЯ ПАНЕЛЬ ОТЛАДКИ (UI)
    // =================================================================
    class DebugUI {
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
                font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
                font-size: 11px; box-shadow: -8px 0 24px rgba(0,0,0,0.3);
                border-left: 1px solid #313244; z-index: 999999; padding: 12px;
                box-sizing: border-box; line-height: 1.4; display: flex;
                flex-direction: column; gap: 8px; transition: transform 0.25s ease, width 0.25s ease;
            `;

            this.container.innerHTML = `
                <div style="font-weight: 600; border-bottom: 1px solid #313244; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center; color: #89b4fa; flex-shrink: 0;">
                    <span>⚡ Автокликер <span style="font-size: 9px; opacity: 0.7;">v8.60 (Vanilla JS)</span></span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span id="ac-ui-status" style="font-size: 10px; background: #2a2b3d; padding: 2px 6px; border-radius: 4px; color: #f9e2af; border: 1px solid #45475a;">ИНИЦИАЛИЗАЦИЯ</span>
                        <button id="ac-ui-toggle" title="Свернуть/Развернуть" style="background: #313244; color: #a6adc8; border: none; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;">—</button>
                    </div>
                </div>
                <div id="ac-ui-content" style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
                    <div style="font-size: 10px; font-weight: 600; color: #a6adc8; flex-shrink: 0; text-transform: uppercase;">Лог действий:</div>
                    <div id="ac-ui-log" style="background: #11111b; padding: 8px; border-radius: 6px; flex: 1 1 60%; overflow-y: auto; color: #bac2de; font-size: 10px; border: 1px solid #1e1e2e; word-break: break-word;"></div>
                    <div style="font-size: 10px; font-weight: 600; color: #a6adc8; flex-shrink: 0; text-transform: uppercase;">Переданный стек параметров:</div>
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
                if (this.isCollapsed) {
                    contentEl.style.display = 'none';
                    this.container.style.height = 'auto';
                    this.container.style.width = '230px';
                    toggleBtn.textContent = '☐';
                } else {
                    contentEl.style.display = 'flex';
                    this.container.style.height = '100vh';
                    this.container.style.width = '360px';
                    toggleBtn.textContent = '—';
                }
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
            console.log(`[AutoClicker] ${msg}`);
        }

        setFields(fieldsArray) {
            if (!this.fieldsEl) return;
            if (!fieldsArray || fieldsArray.length === 0) {
                this.fieldsEl.innerHTML = '<i style="color:#f38ba8;">⚠️ Поля отсутствуют</i>';
                return;
            }
            let html = '';
            fieldsArray.forEach((f, idx) => {
                const defBadge = f.isDefault ? ' <span style="color:#fab387;">[DEFAULT]</span>' : '';
                html += `<div style="margin-bottom: 3px;"><strong style="color: #cba6f7;">[${idx+1}. ${f.type}] ${f.name || 'Поле ' + (idx+1)}${defBadge}:</strong> <span style="color: #f9e2af;">${f.target || 'N/A'}</span> ➔ <span style="color: #a6e3a1;">"${f.value}"</span></div>`;
            });
            this.fieldsEl.innerHTML = html;
        }
    }

    let ui = null;

    // =================================================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
        if (match && match[1]) return match[1].replace('/input', '').trim();
        return parseTargetText(htmlString) || null;
    }

    function resolveTarget(rawName) {
        if (!rawName) return "";
        const clean = parseTargetText(rawName);
        return TARGET_MAP[clean.toLowerCase()] || clean;
    }

    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(err => console.error('Ошибка копирования: ', err));
        }
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
                        if (lastRect && lastRect.top === rect.top && lastRect.left === rect.left) {
                            stableFrames++;
                        } else {
                            stableFrames = 0;
                        }
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
        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
        await sleep(50);
    }

    // =================================================================
    // РАБОТА С СЕТЬЮ И КЕШИРОВАНИЕМ (Чистый fetch)
    // =================================================================
    function fetchTableData() {
        return new Promise((resolve) => {
            const cachedData = localStorage.getItem('avito_autoclick_cache');
            const cachedTime = localStorage.getItem('avito_autoclick_time');
            const now = Date.now();

            if (cachedData && cachedTime && (now - cachedTime < 86400000)) {
                try { return resolve(JSON.parse(cachedData)); } catch (e) {}
            }

            fetch('https://script.google.com/macros/s/AKfycbzSW3uYLSenlUnHKwni5FWANuhzsprGZXQs5T0FoLEA8bVMo9b7YqX0GLM1NiIZxzd25A/exec')
                .then(response => {
                    if (!response.ok) throw new Error('Network error');
                    return response.json();
                })
                .then(data => {
                    localStorage.setItem('avito_autoclick_cache', JSON.stringify(data));
                    localStorage.setItem('avito_autoclick_time', Date.now());
                    resolve(data);
                })
                .catch(() => {
                    if (cachedData) resolve(JSON.parse(cachedData));
                    else resolve({ route: [], fields: [] });
                });
        });
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
            if (score > maxScore) { maxScore = score; bestItem = el; }
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
                    if (match) foundEl = match.closest('[class*="field"], [class*="select"], [role="combobox"]') || match.parentElement;
                }
                return foundEl;
            }, 3000);

            if (!fieldContainer) return false;
            fieldContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(150);

            const clickTarget = fieldContainer.querySelector('[class*="selectWrapper"], button, [role="combobox"]') || fieldContainer;
            await triggerFullClick(clickTarget);
            await sleep(200);

            const targetOption = await waitForFieldReady(() => {
                const options = Array.from(document.querySelectorAll('[data-marker*="option"], [role="option"], div[class*="suggest-item"], li'));
                return findBestMatchingOption(options.filter(el => el.offsetWidth > 0), valClean);
            }, 2000);

            if (targetOption) {
                targetOption.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                await sleep(50);
                await triggerFullClick(targetOption);
                await safeResetDropdownState();
                return true;
            }
            await safeResetDropdownState();
            return false;
        }

        return false;
    }

    // =================================================================
    // 1. СТРАНИЦА: CATALOGS.AVITO.RU
    // =================================================================
    if (window.location.hostname.includes('catalogs.avito.ru')) {
        let preloadedTableData = null;
        fetchTableData().then(data => { preloadedTableData = data; });
        let buttonInjected = false;

        function injectButton() {
            if (buttonInjected) return;
            const targetEl = document.querySelector('button[data-marker="modification-name/historyBtn"]') || document.querySelector('h1');
            if (!targetEl) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = '🚀 Автоклик';
            btn.style.cssText = 'margin-left: 8px; padding: 4px 10px; background-color: #00aaff; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; z-index: 9999;';

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                btn.textContent = '⏳ Сбор...';
                btn.disabled = true;

                try {
                    const catalogSpan = document.querySelector('span[data-marker="modification/select-text"]') || document.querySelector('h1');
                    const catalogText = catalogSpan ? catalogSpan.textContent.trim() : null;
                    if (!catalogText) return alert('Каталог не найден!');

                    const tableData = preloadedTableData || await fetchTableData();
                    const fieldsConfig = tableData.fields || [];
                    const catalogTextNorm = normalizeText(catalogText);

                    let dynamicValues = [];
                    const pageParamsMap = new Map();

                    document.querySelectorAll('div[data-marker="modification/param"]').forEach(row => {
                        const nameLink = row.querySelector('a[data-marker="modification/param-name-link"]');
                        if (!nameLink) return;
                        const valLinks = Array.from(row.querySelectorAll('a[data-marker="modification/value-name-link"]'));
                        pageParamsMap.set(normalizeText(nameLink.textContent), valLinks.map(a => a.textContent.trim()).join(', '));
                    });

                    for (const cfg of fieldsConfig.filter(c => normalizeText(c.Catalog || c.catalog).includes(catalogTextNorm))) {
                        const fieldName = cfg.value;
                        let val = pageParamsMap.get(normalizeText(fieldName)) || cfg.default_value || '';
                        if (fieldName.toLowerCase().includes('модификац') && !val) val = catalogText;

                        dynamicValues.push({ name: fieldName, type: cfg.value_type || "list", target: cfg.value_front_target || fieldName, value: val });
                    }

                    // Используем стандартный localStorage вместо GM_setValue
                    localStorage.setItem('autoclick_active', 'true');
                    localStorage.setItem('selected_catalog', catalogText);
                    localStorage.setItem('extracted_fields', JSON.stringify(dynamicValues));

                    window.location.href = 'https://www.avito.ru/additem';
                } catch (err) {
                    alert(`Ошибка: ${err.message}`);
                } finally {
                    btn.textContent = '🚀 Автоклик';
                    btn.disabled = false;
                }
            });

            targetEl.parentNode.insertBefore(btn, targetEl.nextSibling);
            buttonInjected = true;
        }

        const observer = new MutationObserver(injectButton);
        observer.observe(document.body, { childList: true, subtree: true });
        injectButton();
    }

    // =================================================================
    // 2. СТРАНИЦА: WWW.AVITO.RU/ADDITEM
    // =================================================================
    if (window.location.hostname.includes('avito.ru') && window.location.pathname.includes('/additem')) {
        if (localStorage.getItem('autoclick_active') === 'true') {
            ScrollLock.lock();
            localStorage.setItem('autoclick_active', 'false');

            const selectedCatalog = localStorage.getItem('selected_catalog') || '';
            let extractedFields = [];
            try { extractedFields = JSON.parse(localStorage.getItem('extracted_fields') || '[]'); } catch(e) {}

            if (selectedCatalog) {
                ui = new DebugUI();
                ui.setStatus('ЗАПУСК', '#ffcc00');
                ui.setFields(extractedFields);
                ui.log(`Кликер запущен для: "${selectedCatalog}"`);

                fetchTableData().then(async (responseData) => {
                    ui.setStatus('ЗАПОЛНЕНИЕ', '#00aaff');
                    for (let i = 0; i < extractedFields.length; i++) {
                        await fillFormField(extractedFields[i]);
                        await sleep(100);
                    }
                    ui.setStatus('УСПЕШНО', '#50fa7b');
                    ScrollLock.unlock();
                });
            }
        }
    }
})();
