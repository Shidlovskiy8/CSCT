// =================================================================
// МОНОЛИТНЫЙ СКРИПТ АВТОЗАПОЛНЕНИЯ (ALL-IN-ONE JS)
// =================================================================

// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И СОСТОЯНИЕ (Защита от повторного объявления)
window.TARGET_MAP = window.TARGET_MAP || {};
var ui = window.ui || null;
var isExecuting = window.isExecuting || false;
var CACHE_TTL = 24 * 60 * 60 * 1000;

// =================================================================
// 2. МОДУЛЬ БЛОКИРОВКИ РУЧНОГО СКРОЛЛА (ScrollLock)
// =================================================================
class ScrollLock {
    static isLocked = false;
    static originalOverflow = '';

    static preventDefaultHandler(e) {
        if (e.target && e.target.closest('#autoclick-debug-ui')) {
            return;
        }
        e.preventDefault();
    }

    static preventKeysHandler(e) {
        if (e.target && e.target.closest('#autoclick-debug-ui')) return;
        const keys = [32, 33, 34, 35, 36, 37, 38, 39, 40];
        if (keys.includes(e.keyCode)) {
            e.preventDefault();
        }
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
// 3. ИНТЕРФЕЙС И ЛОГИРОВАНИЕ (DebugUI)
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
            <span>⚡ Автокликер <span style="font-size: 9px; opacity: 0.7;">v8.60</span></span>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span id="ac-ui-status" style="font-size: 10px; background: #2a2b3d; padding: 2px 6px; border-radius: 4px; color: #f9e2af; border: 1px solid #45475a;">ГОТОВ</span>
                <button id="ac-ui-toggle" title="Свернуть/Развернуть" style="background: #313244; color: #a6adc8; border: none; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;">—</button>
            </div>
        </div>

        <div id="ac-ui-content" style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
            <div style="font-size: 10px; font-weight: 600; color: #a6adc8; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.5px;">Лог действий:</div>
            <div id="ac-ui-log" style="background: #11111b; padding: 8px; border-radius: 6px; flex: 1 1 60%; overflow-y: auto; color: #bac2de; font-size: 10px; border: 1px solid #1e1e2e; word-break: break-word;"></div>

            <div style="font-size: 10px; font-weight: 600; color: #a6adc8; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.5px;">Переданный стек параметров:</div>
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
                this.container.style.borderRadius = '0 0 0 8px';
                toggleBtn.textContent = '☐';
            } else {
                contentEl.style.display = 'flex';
                this.container.style.height = '100vh';
                this.container.style.width = '360px';
                this.container.style.borderRadius = '0';
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

// =================================================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И РАБОТА С СЕТЬЮ/КЭШЕМ
// =================================================================
function normalizeText(text) {
    if (!text) return "";
    return String(text)
        .replace(/&nbsp;/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/[—–-]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
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
    if (match && match[1]) {
        return match[1].replace('/input', '').trim();
    }
    return parseTargetText(htmlString) || null;
}

function resolveTarget(rawName) {
    if (!rawName) return "";
    const clean = parseTargetText(rawName);
    const lowerKey = clean.toLowerCase();
    return window.TARGET_MAP[lowerKey] || clean;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanForMatching(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[()–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function fetchTableData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['avito_autoclick_cache', 'avito_autoclick_time'], (storage) => {
            const cachedData = storage.avito_autoclick_cache;
            const cachedTime = storage.avito_autoclick_time;
            const now = Date.now();

            if (cachedData && cachedTime && (now - cachedTime < CACHE_TTL)) {
                try {
                    const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
                    resolve(parsed);
                    updateCacheInBackground();
                    return;
                } catch (e) {}
            }

            fetchFromServer().then(freshData => {
                if (freshData) {
                    resolve(freshData);
                } else if (cachedData) {
                    const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
                    resolve(parsed);
                } else {
                    resolve({ route: [], fields: [] });
                }
            });
        });
    });
}

async function fetchFromServer() {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbzSW3uYLSenlUnHKwni5FWANuhzsprGZXQs5T0FoLEA8bVMo9b7YqX0GLM1NiIZxzd25A/exec', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            chrome.storage.local.set({
                'avito_autoclick_cache': data,
                'avito_autoclick_time': Date.now()
            });
            return data;
        }
    } catch (e) {
        console.error('Ошибка загрузки базы данных:', e);
    }
    return null;
}

function updateCacheInBackground() {
    fetchFromServer();
}

// =================================================================
// 5. ДВИЖОК ПОИСКА И КЛИКОВ ПО DOM-ЭЛЕМЕНТАМ
// =================================================================
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
                const isDisabled = el.hasAttribute('disabled') || el.classList.contains('disabled');

                if (isVisible && !isDisabled) {
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
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    await sleep(50);
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

        tokens.forEach(tok => {
            if (itemTxt.includes(tok)) score += 1;
        });

        if (score > maxScore) {
            maxScore = score;
            bestItem = el;
        }
    });

    return maxScore >= Math.ceil(tokens.length / 2) ? bestItem : null;
}

// =================================================================
// 6. ОСНОВНОЙ МОДУЛЬ ЗАПОЛНЕНИЯ ПОЛЯ (fillFormField)
// =================================================================
async function fillFormField(field) {
    const { type, target, value, name, default_value, targetValue } = field;
    const targetClean = extractParamName(target) || name;

    let valClean = targetValue || parseTargetText(value);
    if (!valClean && default_value) {
        valClean = parseTargetText(default_value) || String(default_value).trim();
    }

    if (!valClean) return false;
    await safeResetDropdownState();

    const isDropdownType = type === 'dropdown' ||
          (name && (name.toLowerCase().includes('модификац') || name.toLowerCase().includes('комплектац') || name.toLowerCase().includes('тип')));

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
                const labelMatch = allLabels.find(el => {
                    const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
                    return text === name.toLowerCase();
                });

                if (labelMatch) {
                    foundEl = labelMatch.closest('[class*="field"], [class*="select"], [role="combobox"], [class*="root"]') ||
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
            const options = Array.from(document.querySelectorAll(
                '[data-marker*="custom-option"], [data-marker*="option"], [role="option"], [role="checkbox"], div[class*="textWrapper"], div[class*="suggest-item"], li'
            ));
            const visibleOptions = options.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            return findBestMatchingOption(visibleOptions, valClean);
        }, 2000);

        if (targetOption) {
            targetOption.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            await sleep(50);
            await triggerFullClick(targetOption);
            window.ui.log(`🎯 [Dropdown] Выбран пункт: "${targetOption.textContent.trim()}"`, '#50fa7b');
            await safeResetDropdownState();
            return true;
        } else {
            window.ui.log(`❌ [Dropdown] Не найден вариант "${valClean}" в списке "${name}"`, '#ff5555');
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

            const candidates = Array.from(scope.querySelectorAll(
                '[role="button"], [role="radio"], label, button, [class*="option-j5fd8"], [class*="item-item"], [class*="chip"], [class*="card"]'
            ));

            const targetNormalized = cleanForMatching(valClean).replace(/ё/g, 'е');
            const targetYears = targetNormalized.match(/\d{4}/g) || [];

            return candidates.find(el => {
                if (el.offsetWidth > 700 || el.offsetHeight > 500) return false;

                const directText = cleanForMatching(el.innerText || el.textContent).replace(/ё/g, 'е');
                if (!directText) return false;

                if (directText === targetNormalized) return true;

                const subLabels = Array.from(el.querySelectorAll('p, span, div'));
                if (subLabels.some(sub => cleanForMatching(sub.textContent).replace(/ё/g, 'е') === targetNormalized)) {
                    return true;
                }

                if (targetYears.length > 0) {
                    const candidateYears = directText.match(/\d{4}/g) || [];
                    const hasYearMatch = targetYears.some(y => candidateYears.includes(y));

                    if (hasYearMatch) {
                        const needsRestyle = targetNormalized.includes('рестайлинг');
                        const hasRestyle = directText.includes('рестайлинг');

                        if (needsRestyle === hasRestyle) {
                            return true;
                        }
                    }
                }

                return false;
            });
        }, 2500);

        if (targetRadioLabel) {
            targetRadioLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(100);

            const inputEl = targetRadioLabel.querySelector('input');
            if (inputEl) {
                inputEl.click();
                inputEl.checked = true;
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const clickTarget = targetRadioLabel.querySelector('p, span, img, label') || targetRadioLabel;
            await triggerFullClick(clickTarget);

            await sleep(50);
            window.ui.log(`🎯 Выбрана радиокнопка/вариант: "${valClean}"`, '#50fa7b');
            return true;
        } else {
            window.ui.log(`⚠️ [Radio/Button] Вариант "${valClean}" не найден, пробуем как input...`, '#ffb86c');
        }
    }

    if (!targetClean) return false;

    const input = await waitForFieldReady(() => {
        return document.querySelector(`input[data-marker*="${targetClean}"]`) ||
            document.querySelector(`input[id="${targetClean}"]`) ||
            document.querySelector(`input[name*="${targetClean}"]`);
    }, 2000);

    if (!input) return false;

    const currentValue = normalizeText(input.value);
    if (currentValue === normalizeText(valClean)) {
        window.ui.log(`ℹ️ Поле "${targetClean}" уже содержит значение "${valClean}". Пропуск.`, '#8be9fd');
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
            const visibleItems = items.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            return findBestMatchingOption(visibleItems, valClean);
        }, 1500);

        if (targetOption) {
            targetOption.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            await sleep(30);
            await triggerFullClick(targetOption);
            window.ui.log(`🎯 Выбран пункт списка: "${targetOption.textContent.trim()}"`, '#50fa7b');
        } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        }

        await sleep(50);
        await safeResetDropdownState();
    }

    return true;
}

// =================================================================
// 7. ИСПОЛНИТЕЛЬНЫЙ ПАЙПЛАЙН (PIPELINE) И СЛУШАТЕЛИ
// =================================================================
async function runAutoClickerPipeline(fieldsStack) {
    if (window.isExecuting) return;
    window.isExecuting = true;

    if (!window.ui) window.ui = new DebugUI();
    window.ui.setStatus('В РАБОТЕ', '#f9e2af');
    window.ui.log('🏁 Запуск заполнения полей на странице...', '#89b4fa');
    
    ScrollLock.lock();

    try {
        window.ui.log('📥 Загрузка справочных данных (Google Sheets/Cache)...', '#bac2de');
        const dbData = await fetchTableData();
        
        if (dbData && dbData.fields) {
            dbData.fields.forEach(f => {
                const targetKey = parseTargetText(f.target || f.name).toLowerCase();
                const sourceKey = parseTargetText(f.name || f.target).toLowerCase();
                if (targetKey && sourceKey) {
                    window.TARGET_MAP[sourceKey] = targetKey;
                }
            });
        }

        let processedFields = [];
        if (Array.isArray(fieldsStack) && fieldsStack.length > 0) {
            processedFields = fieldsStack.map(item => {
                const targetResolved = resolveTarget(item.target || item.name);
                return {
                    ...item,
                    target: targetResolved,
                    targetValue: item.value || item.targetValue || item.default_value
                };
            });
        }

        window.ui.setFields(processedFields);

        if (processedFields.length === 0) {
            window.ui.log('⚠️ Стек параметров пуст. Проверьте переданные данные.', '#ffb86c');
            window.ui.setStatus('ОШИБКА', '#ff5555');
            return;
        }

        let successCount = 0;
        for (let i = 0; i < processedFields.length; i++) {
            const field = processedFields[i];
            const fieldName = field.name || field.target || `Поле #${i + 1}`;

            window.ui.log(`⏳ [${i + 1}/${processedFields.length}] Обработка: "${fieldName}"...`, '#cdd6f4');

            const result = await fillFormField(field);

            if (result) {
                successCount++;
            } else {
                window.ui.log(`⚠️ Не удалось заполнить: "${fieldName}"`, '#ffb86c');
            }

            await sleep(250);
        }

        window.ui.log(`🎉 Заполнение завершено! Успешно: ${successCount} из ${processedFields.length}`, '#50fa7b');
        window.ui.setStatus('ГОТОВО', '#50fa7b');

    } catch (err) {
        console.error('[AutoClicker Error]:', err);
        window.ui.log(`💥 Критическая ошибка: ${err.message}`, '#ff5555');
        window.ui.setStatus('СБОЙ', '#ff5555');
    } finally {
        ScrollLock.unlock();
        window.isExecuting = false;
    }
}

// Защищенный регистратор сообщений для Chrome API
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'START_AUTOCLICK') {
            if (window.isExecuting) {
                window.ui?.log('⚠️ Процесс автокликера уже запущен!', '#ffb86c');
                sendResponse({ status: 'already_running' });
                return true;
            }
            
            const fieldsStack = request.fields || [];
            runAutoClickerPipeline(fieldsStack);
            sendResponse({ status: 'started' });
        }
        return true;
    });
}

// Хоткей F2 для мгновенной отладки
window.addEventListener('keydown', (e) => {
    if (e.key === 'F2' && !window.isExecuting) {
        window.ui?.log('🚀 Запуск автокликера по клавише F2...', '#89b4fa');
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['pendingFieldsStack'], (data) => {
                if (data.pendingFieldsStack && data.pendingFieldsStack.length > 0) {
                    runAutoClickerPipeline(data.pendingFieldsStack);
                } else {
                    window.ui?.log('❌ Ошибка: В локальном хранилище нет сохраненного стека полей!', '#ff5555');
                }
            });
        }
    }
});

// Точка входа: гарантированная инициализация UI при любой стадии загрузки
(function initExtensionContext() {
    const mountUI = () => {
        if (!window.ui) {
            window.ui = new DebugUI();
            window.ui.log('💡 Автокликер готов к работе (F2 или расширение).', '#89b4fa');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountUI);
    } else {
        mountUI();
    }
    
    // Проверка автостарта по стеку из storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['pendingFieldsStack'], (data) => {
            if (data.pendingFieldsStack && data.pendingFieldsStack.length > 0) {
                runAutoClickerPipeline(data.pendingFieldsStack);
            }
        });
    }
})();
