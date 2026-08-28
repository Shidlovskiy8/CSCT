/**
 * Utility Helpers Module
 */

const TARGET_MAP = {};

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

function cleanForMatching(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[()–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Копирование текста в буфер обмена с поддержкой Chrome API
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Ошибка копирования в буфер обмена: ', err);
    });
  }
}

/**
 * Ожидание готовности элемента в DOM (видимость + отсутствие анимации)
 */
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

/**
 * Полный клик с генерацией Pointer, Mouse и Click событий
 */
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

/**
 * Установка значения input с эмуляцией нативного сеттера React/Vue
 */
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
