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
                <span id="ac-ui-status" style="font-size: 10px; background: #2a2b3d; padding: 2px 6px; border-radius: 4px; color: #f9e2af; border: 1px solid #45475a;">ИНИЦИАЛИЗАЦИЯ</span>
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

let ui = null;

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
    return TARGET_MAP[lowerKey] || clean;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function copyToClipboard(text) {
    if (typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Ошибка копирования в буфер обмена: ', err);
        });
    }
}

// =================================================================
// ОЖИДАНИЕ: Поиск + проверка видимости, готовности и анимации
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

const CACHE_TTL = 24 * 60 * 60 * 1000;

function fetchTableData() {
    return new Promise((resolve) => {
        const cachedData = localStorage.getItem('avito_autoclick_cache');
        const cachedTime = localStorage.getItem('avito_autoclick_time');
        const now = Date.now();

        if (cachedData && cachedTime && (now - cachedTime < CACHE_TTL)) {
            try {
                const parsed = JSON.parse(cachedData);
                resolve(parsed);
                updateCacheInBackground();
                return;
            } catch (e) {}
        }

        fetchFromServer().then(freshData => {
            if (freshData) {
                resolve(freshData);
            } else if (cachedData) {
                resolve(JSON.parse(cachedData));
            } else {
                resolve({ route: [], fields: [] });
            }
        });
    });
}

function fetchFromServer() {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: 'https://script.google.com/macros/s/AKfycbzSW3uYLSenlUnHKwni5FWANuhzsprGZXQs5T0FoLEA8bVMo9b7YqX0GLM1NiIZxzd25A/exec',
            timeout: 10000,
            onload: (response) => {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        localStorage.setItem('avito_autoclick_cache', JSON.stringify(data));
                        localStorage.setItem('avito_autoclick_time', Date.now());
                        resolve(data);
                        return;
                    } catch (e) {}
                }
                resolve(null);
            },
            onerror: () => resolve(null),
            ontimeout: () => resolve(null)
        });
    });
}

function updateCacheInBackground() {
    fetchFromServer();
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

async function promptUserForCustomValue(fieldName, options) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        z-index: 999999; background: #282a36; color: #f8f8f2; padding: 20px;
        border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        font-family: sans-serif; min-width: 300px; border: 1px solid #6272a4;
    `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.type = 'button';
        closeBtn.style.cssText = `
        position: absolute; top: 10px; right: 12px; background: transparent;
        border: none; color: #6272a4; font-size: 20px; font-weight: bold;
        cursor: pointer; padding: 0; line-height: 1; outline: none;
    `;
        closeBtn.onmouseover = () => closeBtn.style.color = '#ff5555';
        closeBtn.onmouseout = () => closeBtn.style.color = '#6272a4';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: bold; margin-bottom: 12px; margin-right: 20px; font-size: 14px; color: #50fa7b;';
        title.textContent = `Выберите значение для "${fieldName}":`;

        const select = document.createElement('select');
        select.style.cssText = `
        width: 100%; padding: 8px; background: #44475a; color: #fff;
        border: 1px solid #6272a4; border-radius: 4px; margin-bottom: 15px;
        outline: none; font-size: 14px;
    `;

        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt;
            optionEl.textContent = opt;
            select.appendChild(optionEl);
        });

        const btn = document.createElement('button');
        btn.textContent = 'Подтвердить';
        btn.type = 'button';
        btn.style.cssText = `
        width: 100%; padding: 8px; background: #50fa7b; color: #282a36;
        font-weight: bold; border: none; border-radius: 4px; cursor: pointer;
    `;

        const closeModal = (resultValue) => {
            window.removeEventListener('keydown', handleKeyDown);
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            resolve(resultValue);
        };

        btn.onclick = () => {
            closeModal(select.value);
        };

        closeBtn.onclick = () => {
            closeModal(null);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeModal(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        modal.appendChild(closeBtn);
        modal.appendChild(title);
        modal.appendChild(select);
        modal.appendChild(btn);
        document.body.appendChild(modal);
    });
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

// =================================================================
// МОДУЛЬ ЗАПОЛНЕНИЯ ПОЛЯ С АВТО-СКРОЛЛОМ
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
            ui.log(`❌ Поле "${name}" (${targetClean}) не найдено`, '#ff5555');
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
            ui.log(`🎯 [Dropdown] Выбран пункт: "${targetOption.textContent.trim()}"`, '#50fa7b');
            await safeResetDropdownState();
            return true;
        } else {
            ui.log(`❌ [Dropdown] Не найден вариант "${valClean}" в списке "${name}"`, '#ff5555');
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
            ui.log(`🎯 Выбрана радиокнопка/вариант: "${valClean}"`, '#50fa7b');
            return true;
        } else {
            ui.log(`⚠️ [Radio/Button] Вариант "${valClean}" не найден, пробуем как input...`, '#ffb86c');
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
        ui.log(`ℹ️ Поле "${targetClean}" уже содержит значение "${valClean}". Пропуск.`, '#8be9fd');
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
            ui.log(`🎯 Выбран пункт списка: "${targetOption.textContent.trim()}"`, '#50fa7b');
        } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        }

        await sleep(50);
        await safeResetDropdownState();
    }

    return true;
}

// =================================================================
// 1. СТРАНИЦА: CATALOGS.AVITO.RU
// =================================================================
if (window.location.hostname.includes('catalogs.avito.ru')) {
    let preloadedTableData = null;
    fetchTableData().then(data => { preloadedTableData = data; }).catch(() => {});

    let buttonInjected = false;

    function injectButton() {
        if (buttonInjected) return;

        const targetEl = document.querySelector('button[data-marker="modification-name/historyBtn"]') ||
              document.querySelector('[class*="modification-name"]') ||
              document.querySelector('h1');

        if (!targetEl) return;

        const existingBtn = targetEl.parentNode?.querySelector('button[textContent*="Автоклик"]');
        if (existingBtn) {
            buttonInjected = true;
            return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '🚀 Автоклик';
        btn.style.cssText = `
        margin-left: 8px; padding: 4px 10px; background-color: #00aaff;
        color: #ffffff; border: none; border-radius: 4px; cursor: pointer;
        font-size: 12px; font-weight: bold; vertical-align: middle; z-index: 9999;
    `;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            btn.textContent = '⏳ Сбор...';
            btn.disabled = true;

            try {
                const catalogSpan = document.querySelector('span.styles-module-size_s-e9rn2') ||
                      document.querySelector('span[data-marker="modification/select-text"]') ||
                      document.querySelector('h1');
                const catalogText = catalogSpan ? catalogSpan.textContent.trim() : null;

                if (!catalogText) {
                    alert('Не удалось определить название каталога на странице!');
                    return;
                }

                let dynamicValues = [];
                const catalogTextNorm = normalizeText(catalogText);

                const tableData = preloadedTableData || await fetchTableData();
                const fieldsConfig = tableData.fields || [];

                if (fieldsConfig.length > 0) {
                    const matchingFieldsConfig = fieldsConfig.filter(cfg => {
                        const fieldCatalog = cfg.Catalog || cfg.catalog || cfg.catalog_name;
                        if (!fieldCatalog) return false;
                        const cfgCatNorm = normalizeText(parseTargetText(fieldCatalog));
                        return cfgCatNorm && (catalogTextNorm.includes(cfgCatNorm) || cfgCatNorm.includes(catalogTextNorm));
                    });

                    const pageParamsMap = new Map();

                    document.querySelectorAll('div[data-marker="modification/param"]').forEach(row => {
                        const nameLink = row.querySelector('a[data-marker="modification/param-name-link"]');
                        if (!nameLink) return;

                        const paramNameKey = normalizeText(nameLink.textContent);
                        const valLinks = Array.from(row.querySelectorAll('a[data-marker="modification/value-name-link"]'));

                        if (valLinks.length > 0) {
                            const combinedValues = valLinks.map(a => a.textContent.trim()).filter(Boolean).join(', ');
                            pageParamsMap.set(paramNameKey, combinedValues);
                        } else {
                            const valContainer = row.querySelector('[class*="valueList"], [class*="valueContainer"], span');
                            if (valContainer) {
                                pageParamsMap.set(paramNameKey, valContainer.textContent.trim());
                            }
                        }
                    });

                    for (const cfg of matchingFieldsConfig) {
                        const fieldName = cfg.value;
                        if (!fieldName) continue;

                        const paramTarget = cfg.value_front_target || fieldName;
                        const paramType = cfg.value_type || "list";
                        const normFieldName = normalizeText(fieldName);

                        const tableDefaultVal = cfg.default_value || cfg.defaultValue || cfg.default;
                        const rawCustomType = cfg.custom_value_type || cfg.customValueType || "";
                        const customType = String(rawCustomType).trim().toLowerCase();
                        let customVal = cfg.custom_value || cfg.customValue || "";

                        const pageParsedValue = pageParamsMap.get(normFieldName) || null;

                        let val = null;
                        let isDefault = false;

                        if (customType === 'catalog') {
                            if (pageParsedValue) {
                                customVal = pageParsedValue;
                            } else if (fieldName.toLowerCase().includes('модификац')) {
                                customVal = catalogText;
                            }
                        }

                        if (tableDefaultVal && String(tableDefaultVal).trim() !== "") {
                            val = String(tableDefaultVal).trim();
                            isDefault = true;
                        } else {
                            val = pageParsedValue ? pageParsedValue.split(',')[0].trim() : null;
                            if (!val && fieldName.toLowerCase().includes('модификац')) {
                                val = catalogText;
                            }
                        }

                        let userSelectedValue = null;
                        if ((customType === 'list' || customType === 'catalog') && customVal) {
                            const options = String(customVal).split(',').map(opt => opt.trim()).filter(Boolean);
                            if (options.length > 0) {
                                btn.textContent = `⏳ Выбор: ${fieldName}`;
                                userSelectedValue = await promptUserForCustomValue(fieldName, options);

                                if (userSelectedValue === null) {
                                    btn.textContent = '🚀 Автоклик';
                                    btn.disabled = false;
                                    return;
                                }
                            }
                        }

                        if (userSelectedValue) {
                            val = userSelectedValue;
                        }

                        if (val || customVal) {
                            dynamicValues.push({
                                name: fieldName,
                                type: paramType,
                                target: paramTarget,
                                value: val,
                                default_value: tableDefaultVal,
                                custom_value_type: customType,
                                custom_value: customVal,
                                isDefault: isDefault
                            });
                        }
                    }

                    dynamicValues.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
                }

                let categoryChainStr = '';
                const routeData = tableData.route || tableData;
                if (Array.isArray(routeData)) {
                    let routeRow = routeData.find(r => {
                        const cat = normalizeText(parseTargetText(r.Catalog || r.catalog));
                        return cat && (catalogTextNorm.includes(cat) || cat.includes(catalogTextNorm));
                    });

                    if (routeRow) {
                        const catSteps = [];
                        if (routeRow.category) {
                            catSteps.push(resolveTarget(routeRow.category));
                        }

                        const stepKeys = Object.keys(routeRow)
                            .filter(key => /^step\d+$/i.test(key))
                            .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));

                        stepKeys.forEach(k => {
                            if (routeRow[k]) {
                                catSteps.push(resolveTarget(routeRow[k]));
                            }
                        });

                        if (catSteps.length > 0) {
                            categoryChainStr = catSteps.join(' / ');
                        }
                    }
                }

                const clipboardLines = [];

                if (categoryChainStr) {
                    clipboardLines.push(`Категория: ${categoryChainStr}`);
                    clipboardLines.push('');
                }

                dynamicValues.forEach(f => {
                    let finalVal = parseTargetText(f.value);
                    if (!finalVal && f.default_value) {
                        finalVal = parseTargetText(f.default_value) || String(f.default_value).trim();
                    }
                    clipboardLines.push(`${f.name}: «${finalVal || ''}»`);
                });

                if (clipboardLines.length > 0) {
                    copyToClipboard(clipboardLines.join('\n'));
                }

                const jsonFields = JSON.stringify(dynamicValues);
                await localStorage.setItem('selected_catalog', catalogText);
                await localStorage.setItem('extracted_fields', jsonFields);
                await localStorage.setItem('autoclick_active', true);

                try {
                    localStorage.setItem('ac_selected_catalog', catalogText);
                    localStorage.setItem('ac_extracted_fields', jsonFields);
                    localStorage.setItem('ac_autoclick_active', 'true');
                } catch(e) {}

                window.open('https://www.avito.ru/additem', '_blank');

            } catch (err) {
                console.error("[AutoClicker Error]", err);
                alert(`Ошибка автокликера: ${err.message || err}`);
            } finally {
                btn.textContent = '🚀 Автоклик';
                btn.disabled = false;
            }
        });

        if (targetEl.parentNode) {
            targetEl.parentNode.insertBefore(btn, targetEl.nextSibling);
            buttonInjected = true;
        }
    }

    let lastHref = window.location.href;
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastHref) {
            lastHref = window.location.href;
            buttonInjected = false;
            injectButton();
        }
    });
    urlObserver.observe(document.head, { childList: true, subtree: true });

    const observer = new MutationObserver(() => {
        injectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    injectButton();
}

// =================================================================
// 2. СТРАНИЦА: WWW.AVITO.RU/ADDITEM
// =================================================================
if (window.location.hostname.includes('avito.ru') && window.location.pathname.includes('/additem')) {

    const isActive = localStorage.getItem('autoclick_active', false) || localStorage.getItem('ac_autoclick_active') === 'true';
    if (!isActive) return;

    async function runPipeline() {
        ScrollLock.lock();

        try {
            await GM_setValue('autoclick_active', false);
            localStorage.removeItem('ac_autoclick_active');

            let selectedCatalog = localStorage.getItem('selected_catalog', null) || localStorage.getItem('ac_selected_catalog');
            let extractedFieldsRaw = localStorage.getItem('extracted_fields', null) || localStorage.getItem('ac_extracted_fields') || '[]';

            let extractedFields = [];
            try { extractedFields = JSON.parse(extractedFieldsRaw); } catch(e) { extractedFields = []; }

            if (!selectedCatalog) return;

            ui = new DebugUI();
            ui.setStatus('ЗАПУСК', '#ffcc00');
            ui.setFields(extractedFields);
            ui.log(`Кликер запущен для: "${selectedCatalog}"`);

            await safeResetDropdownState();

            const anotherCategoryBtn = await waitForFieldReady(() => {
                const btn = document.querySelector('button[data-marker="another-category"]');
                if (btn) return btn;
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(b => b.innerText && normalizeText(b.innerText).includes('другая категория'));
            }, 1200);

            if (anotherCategoryBtn) {
                await triggerFullClick(anotherCategoryBtn);
                ui.log('Клик "Другая категория"', '#50fa7b');
                await sleep(200);
            }

            ui.setStatus('ЗАГРУЗКА', '#00aaff');
            let responseData;
            try {
                responseData = await fetchTableData();
                ui.log('Таблица загружена', '#50fa7b');
            } catch (err) {
                ui.setStatus('ОШИБКА СЕТИ', '#ff5555');
                ui.log(`❌ Ошибка загрузки: ${err}`, '#ff5555');
                return;
            }

            const routeData = responseData.route || responseData;
            const targetCatalogNorm = normalizeText(selectedCatalog);

            let routeRow = routeData.find(r => {
                const cat = normalizeText(parseTargetText(r.Catalog || r.catalog));
                return cat && (targetCatalogNorm.includes(cat) || cat.includes(targetCatalogNorm));
            });

            if (!routeRow) {
                ui.setStatus('НЕ НАЙДЕНО', '#ff5555');
                ui.log(`❌ Категория "${selectedCatalog}" не найдена в route!`, '#ff5555');
                return;
            }

            const getSuggestValue = (val) => String(val || '').trim().toUpperCase() === 'TRUE';
            const chain = [];

            if (routeRow.category) {
                chain.push({ name: 'category', value: resolveTarget(routeRow.category) });
            }

            const stepKeys = Object.keys(routeRow)
            .filter(key => /^step\d+$/i.test(key))
            .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));

            for (let i = 0; i < stepKeys.length; i++) {
                const currentStepKey = stepKeys[i];
                const stepNum = currentStepKey.replace(/\D/g, '');
                const suggestKey = `suggest${stepNum}`;

                if (getSuggestValue(routeRow[suggestKey])) {
                    const prevStep = chain[chain.length - 1];
                    if (prevStep) {
                        chain.push({ name: suggestKey, value: prevStep.value, isSuggest: true });
                    }
                }

                if (routeRow[currentStepKey]) {
                    chain.push({ name: currentStepKey, value: resolveTarget(routeRow[currentStepKey]), isSuggest: false });
                }
            }

            for (let step of chain) {
                const targetNorm = normalizeText(step.value);
                ui.setStatus(`КЛИК ${step.name.toUpperCase()}`, '#00aaff');

                if (step.isSuggest) {
                    ui.log(`Поиск подсказки (${step.name}): "${step.value}"...`);
                    const suggestElement = await waitForFieldReady(() => {
                        const spans = Array.from(document.querySelectorAll('span[style*="var(--theme-semantics-text-secondary)"]'));
                        return spans.find(el => normalizeText(el.innerText || el.textContent) === targetNorm);
                    }, 2000);

                    if (suggestElement) {
                        await triggerFullClick(suggestElement);
                        ui.log(`Выбрана подсказка (${step.name}): "${step.value}"`, '#50fa7b');
                        await sleep(200);
                    } else {
                        ui.log(`⚠️ Не найдена подсказка (${step.name}) для: "${step.value}"`, '#ffb86c');
                    }
                } else {
                    ui.log(`Поиск категории: "${step.value}"...`);
                    const element = await waitForFieldReady(() => {
                        const buttons = Array.from(document.querySelectorAll('[data-marker="category-wizard/button"]'));
                        return buttons.find(el => normalizeText(el.innerText || el.textContent) === targetNorm);
                    }, 2000);

                    if (element) {
                        await triggerFullClick(element);
                        ui.log(`Выбрано: "${step.value}"`, '#50fa7b');
                        await sleep(200);
                    } else {
                        ui.log(`⚠️ Пропущен шаг ${step.name}: элемент "${step.value}" не найден`, '#ffb86c');
                    }
                }
            }

            ui.setStatus('ПОДГОТОВКА ПОЛЕЙ', '#00aaff');
            ui.log('--- ROUTE ЗАВЕРШЕН, ПЕРЕХОД К ПОЛЯМ ---', '#00aaff');

            if (extractedFields.length > 0) {
                ui.log(`Запуск заполнения полей (всего: ${extractedFields.length})`);
                ui.setStatus('ЗАПОЛНЕНИЕ ПОЛЕЙ', '#00aaff');

                for (let i = 0; i < extractedFields.length; i++) {
                    const field = extractedFields[i];
                    let cleanVal = parseTargetText(field.value);
                    let isUsingDefault = false;

                    if (!cleanVal && field.default_value) {
                        cleanVal = parseTargetText(field.default_value) || String(field.default_value).trim();
                        isUsingDefault = true;
                    }

                    if (!cleanVal) {
                        ui.log(`⚠️ [${i + 1}/${extractedFields.length}] Пропущено поле "${field.name}" (нет значения)`, '#ffb86c');
                        continue;
                    }

                    const logTag = isUsingDefault ? ' [DEFAULT]' : '';
                    ui.log(`👉 [${i + 1}/${extractedFields.length}] Поле "${field.name}" (${field.type})${logTag} ➔ "${cleanVal}"`, '#f1fa8c');

                    if (i > 0) await sleep(150);

                    const fieldToFill = {
                        ...field,
                        targetValue: cleanVal,
                        isDefaultUsed: isUsingDefault
                    };

                    const success = await fillFormField(fieldToFill);

                    if (success) {
                        ui.log(`✅ [${i + 1}/${extractedFields.length}] Готово: "${field.name}"`, '#50fa7b');
                        if (isUsingDefault || field.name.toLowerCase().includes('тип') || field.name.toLowerCase().includes('марк')) {
                            ui.log(`⏳ Ожидание появления зависимых полей...`, '#00aaff');
                            await sleep(800);
                        }
                    } else {
                        ui.log(`❌ [${i + 1}/${extractedFields.length}] Не удалось заполнить: ${field.name}`, '#ff5555');
                    }
                    await sleep(100);
                }
            } else {
                ui.log(`⚠️ Массив полей пуст!`, '#ffb86c');
            }

            ui.setStatus('УСПЕШНО', '#50fa7b');
            ui.log('Все операции завершены! 🎉', '#50fa7b');
        } finally {
            ScrollLock.unlock();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runPipeline);
    } else {
        runPipeline();
    }
}
})();
