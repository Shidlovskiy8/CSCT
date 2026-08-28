(function() {
    'use strict';

    if (!window.location.hostname.includes('catalogs.avito.ru')) {
        return;
    }

    // Заглушки или функции для вспомогательной логики (если они не определены глобально)
    const fetchTableData = window.fetchTableData || async function() { return { fields: [], route: [] }; };
    const normalizeText = window.normalizeText || function(text) { return text ? String(text).trim().toLowerCase() : ''; };
    const parseTargetText = window.parseTargetText || function(text) { return text ? String(text).trim() : ''; };
    const resolveTarget = window.resolveTarget || function(text) { return text ? String(text).trim() : ''; };
    const promptUserForCustomValue = window.promptUserForCustomValue || async function(fieldName, options) { return options[0]; };
    const copyToClipboard = window.copyToClipboard || function(text) {
        navigator.clipboard.writeText(text).catch(() => {});
    };

    let preloadedTableData = null;
    fetchTableData().then(data => { preloadedTableData = data; }).catch(() => {});

    let buttonInjected = false;

    function injectButton() {
        if (buttonInjected) return;

        const targetEl = document.querySelector('button[data-marker="modification-name/historyBtn"]') ||
              document.querySelector('[class*="modification-name"]') ||
              document.querySelector('h1');

        if (!targetEl) return;

        const existingBtn = targetEl.parentNode?.querySelector('button[id*="tm-inline-webhook-btn"]') ||
              Array.from(targetEl.parentNode?.querySelectorAll('button') || []).find(b => b.textContent.includes('Автоклик'));
              
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
            display: inline-flex; align-items: center; gap: 4px;
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
                
                if (typeof GM_setValue === 'function') {
                    await GM_setValue('selected_catalog', catalogText);
                    await GM_setValue('extracted_fields', jsonFields);
                    await GM_setValue('autoclick_active', true);
                }

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
            setTimeout(injectButton, 300);
        }
    });
    
    if (document.head) {
        urlObserver.observe(document.head, { childList: true, subtree: true });
    }

    const observer = new MutationObserver(() => {
        injectButton();
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        injectButton();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
            injectButton();
        });
    }
})();
