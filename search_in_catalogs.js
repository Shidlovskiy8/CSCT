(function() {
    'use strict';

    // Маппинг каталогов к их ID (paramId)
    const catalogIdMap = {
        'lifestyle_katalog_avtorov_knigi_dlya_detej': '201181',
        'lifestyle_knigi_hudozhestvennaya_literatura': '201244',
        'lifestyle_katalog_avtorov_knigi_na_inostrannyh_yazykah': '202122',
        'nehudozhestvennaya_literatura': '201246'
    };

    // Флаг, чтобы не создавать кнопку повторно
    let buttonCreated = false;

    // Улучшенная функция ожидания с MutationObserver
    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

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

    // Создаем кнопку после блока с радио-кнопками
    function createTriggerButton() {
        // Если кнопка уже создана - выходим
        if (document.getElementById('catalog-search-trigger-btn')) {
            return;
        }

        const radioGroup = document.querySelector('div[data-userscript-marker="commentFormTopControlsTypeSwitch/type-switch-marker"]');

        if (!radioGroup) {
            setTimeout(createTriggerButton, 100);
            return;
        }

        buttonCreated = true;

        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'catalog-search-trigger-btn';
        buttonContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 12px;
            vertical-align: middle;
        `;

        const triggerButton = document.createElement('button');
        triggerButton.textContent = '📚 Поиск в каталогах';
        triggerButton.type = 'button';
        triggerButton.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 14px;
            height: 32px;
            font-size: 13px;
            font-family: inherit;
            font-weight: 400;
            line-height: 32px;
            color: #fff;
            background-color: #1890ff;
            border: 1px solid #1890ff;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
            box-sizing: border-box;
            outline: none;
        `;

        triggerButton.addEventListener('mouseenter', () => {
            triggerButton.style.backgroundColor = '#40a9ff';
            triggerButton.style.borderColor = '#40a9ff';
        });

        triggerButton.addEventListener('mouseleave', () => {
            triggerButton.style.backgroundColor = '#1890ff';
            triggerButton.style.borderColor = '#1890ff';
        });

        triggerButton.addEventListener('mousedown', () => {
            triggerButton.style.backgroundColor = '#096dd9';
            triggerButton.style.borderColor = '#096dd9';
        });

        triggerButton.addEventListener('mouseup', () => {
            triggerButton.style.backgroundColor = '#40a9ff';
            triggerButton.style.borderColor = '#40a9ff';
        });

        triggerButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openModal();
        });

        buttonContainer.appendChild(triggerButton);
        radioGroup.parentElement.appendChild(buttonContainer);
    }

    // Парсит текст ответа и превращает в массив записей
    function parseResponseToRecords(text) {
        const records = [];
        const blocks = text.split(/^-{3,}\s*$/m);

        blocks.forEach(block => {
            const trimmed = block.trim();
            if (!trimmed) return;

            const lines = trimmed.split('\n');
            const record = {
                author: '',
                uid: '',
                linkText: '',
                linkUrl: ''
            };

            lines.forEach(line => {
                const authorMatch = line.match(/^Автор:\s*(.+)$/i);
                const uidMatch = line.match(/^UID:\s*(.+)$/i);
                const linkMatch = line.match(/^Ссылка:\s*\[([^\]]+)\]\(([^)]+)\)/i);

                if (authorMatch) {
                    record.author = authorMatch[1].trim();
                } else if (uidMatch) {
                    record.uid = uidMatch[1].trim();
                } else if (linkMatch) {
                    record.linkText = linkMatch[1].trim();
                    record.linkUrl = linkMatch[2].trim();
                }
            });

            if (record.author || record.uid || record.linkUrl) {
                records.push(record);
            }
        });

        return records;
    }

    // Рендерит таблицу с результатами
    function renderTable(records) {
        if (records.length === 0) {
            return '<div style="color: #999; text-align: center; padding: 20px;">Нет данных для отображения</div>';
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background-color: #fafafa; border-bottom: 2px solid #d9d9d9;">
                        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #262626;">Автор</th>
                        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #262626;">UID</th>
                        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #262626;">Ссылка</th>
                    </tr>
                </thead>
                <tbody>
        `;

        records.forEach((record, index) => {
            const rowColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
            html += `
                <tr style="background-color: ${rowColor}; border-bottom: 1px solid #e8e8e8;">
                    <td style="padding: 10px 8px; color: #262626;">${record.author || '—'}</td>
                    <td style="padding: 10px 8px; color: #595959; font-family: monospace;">${record.uid || '—'}</td>
                    <td style="padding: 10px 8px;">
                        ${record.linkUrl ? `<a href="${record.linkUrl}" target="_blank" style="color: #1890ff; text-decoration: none; font-weight: 500;">${record.linkText || 'Открыть'}</a>` : '—'}
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    }

    // Создаем модальное окно
    function openModal() {
        if (document.getElementById('catalog-search-modal')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'catalog-search-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.45);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            width: 600px;
            max-width: 90%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #e8e8e8;
            padding-bottom: 16px;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Поиск по каталогам';
        title.style.cssText = `
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #262626;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
            padding: 0;
            width: 30px;
            height: 30px;
            line-height: 30px;
            text-align: center;
            border-radius: 4px;
            transition: all 0.3s;
        `;
        closeBtn.addEventListener('mouseover', () => {
            closeBtn.style.backgroundColor = '#f5f5f5';
            closeBtn.style.color = '#40a9ff';
        });
        closeBtn.addEventListener('mouseout', () => {
            closeBtn.style.backgroundColor = 'transparent';
            closeBtn.style.color = '#999';
        });
        closeBtn.addEventListener('click', () => {
            closeModal();
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        const form = document.createElement('div');

        const catalogLabel = document.createElement('label');
        catalogLabel.textContent = 'Каталог:';
        catalogLabel.style.cssText = `
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #262626;
        `;

        const catalogSelect = document.createElement('select');
        catalogSelect.id = 'catalog-select';
        catalogSelect.required = true;
        catalogSelect.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 14px;
            margin-bottom: 16px;
            background: white;
        `;

        const catalogs = [
            'nehudozhestvennaya_literatura',
            'lifestyle_knigi_hudozhestvennaya_literatura',
            'lifestyle_katalog_avtorov_knigi_na_inostrannyh_yazykah',
            'lifestyle_katalog_avtorov_knigi_dlya_detej'
        ];

        catalogs.forEach(catalog => {
            const option = document.createElement('option');
            option.value = catalog;
            option.textContent = catalog;
            catalogSelect.appendChild(option);
        });

        const authorLabel = document.createElement('label');
        authorLabel.textContent = 'Автор *:';
        authorLabel.style.cssText = `
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #262626;
        `;

        const authorInput = document.createElement('input');
        authorInput.type = 'text';
        authorInput.id = 'author-input';
        authorInput.placeholder = 'Введите имя автора';
        authorInput.required = true;
        authorInput.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 14px;
            margin-bottom: 16px;
            box-sizing: border-box;
        `;

        const searchButton = document.createElement('button');
        searchButton.textContent = '🔍 Поиск в каталогах';
        searchButton.style.cssText = `
            width: 100%;
            padding: 10px 16px;
            background-color: #1890ff;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 16px;
        `;

        searchButton.addEventListener('mouseover', () => {
            searchButton.style.backgroundColor = '#40a9ff';
        });

        searchButton.addEventListener('mouseout', () => {
            searchButton.style.backgroundColor = '#1890ff';
        });

        searchButton.addEventListener('click', () => {
            sendToWebhook();
        });

        const responseLabel = document.createElement('label');
        responseLabel.textContent = 'Результаты:';
        responseLabel.style.cssText = `
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #262626;
        `;

        const responseArea = document.createElement('div');
        responseArea.id = 'response-area';
        responseArea.style.cssText = `
            width: 100%;
            min-height: 150px;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 14px;
            background-color: #fafafa;
            box-sizing: border-box;
        `;

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Закрыть';
        closeButton.style.cssText = `
            width: 100%;
            padding: 10px 16px;
            background-color: #f0f0f0;
            color: #262626;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 12px;
        `;

        closeButton.addEventListener('mouseover', () => {
            closeButton.style.backgroundColor = '#e6e6e6';
        });

        closeButton.addEventListener('mouseout', () => {
            closeButton.style.backgroundColor = '#f0f0f0';
        });

        closeButton.addEventListener('click', () => {
            closeModal();
        });

        form.appendChild(catalogLabel);
        form.appendChild(catalogSelect);
        form.appendChild(authorLabel);
        form.appendChild(authorInput);
        form.appendChild(searchButton);
        form.appendChild(responseLabel);
        form.appendChild(responseArea);
        form.appendChild(closeButton);

        modal.appendChild(header);
        modal.appendChild(form);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function sendToWebhook() {
            const catalog = catalogSelect.value;
            const author = authorInput.value.trim();

            if (!author) {
                alert('Пожалуйста, заполните поле "Автор"');
                return;
            }

            const paramId = catalogIdMap[catalog];

            console.log('Sending webhook:', {
                catalog: catalog,
                author: author,
                paramId: paramId,
                timestamp: new Date().toISOString()
            });

            searchButton.disabled = true;
            searchButton.textContent = '⏳ Загрузка...';
            searchButton.style.backgroundColor = '#91d5ff';
            responseArea.innerHTML = '';

            const webhookUrl = 'https://bpa-n8n-stage.k.avito.ru/webhook/266e636b-a0ff-4a04-a8a1-691fac10697f';

            const payload = {
                catalog: catalog,
                author: author,
                paramId: paramId,
                timestamp: new Date().toISOString()
            };

              fetch(webhookUrl, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload)
              })
              .then(async (response) => {
                  searchButton.disabled = false;
                  searchButton.textContent = '🔍 Поиск в каталогах';
                  searchButton.style.backgroundColor = '#1890ff';
              
                  const textData = await response.text();
              
                  if (response.ok) { // Аналог response.status >= 200 && status < 300
                      try {
                          const jsonData = JSON.parse(textData);
                          if (jsonData.results || Array.isArray(jsonData)) {
                              const records = Array.isArray(jsonData) ? jsonData : jsonData.results;
                              responseArea.innerHTML = renderTable(records);
                          } else {
                              responseArea.innerHTML = '<pre style="margin: 0; white-space: pre-wrap; font-size: 12px;">' +
                                  JSON.stringify(jsonData, null, 2) +
                                  '</pre>';
                          }
                      } catch (e) {
                          const records = parseResponseToRecords(textData);
                          responseArea.innerHTML = renderTable(records);
                      }
                  } else {
                      responseArea.innerHTML = `<div style="color: #cf1322; padding: 12px;">Ошибка: HTTP ${response.status}<br>${textData}</div>`;
                      responseArea.style.backgroundColor = '#fff1f0';
                      responseArea.style.borderColor = '#ffa39e';
                  }
              })
              .catch((error) => {
                  searchButton.disabled = false;
                  searchButton.textContent = '🔍 Поиск в каталогах';
                  searchButton.style.backgroundColor = '#1890ff';
                  responseArea.innerHTML = `<div style="color: #cf1322; padding: 12px;">Ошибка сети: ${error.message}</div>`;
                  responseArea.style.backgroundColor = '#fff1f0';
                  responseArea.style.borderColor = '#ffa39e';
              });
        }

        function closeModal() {
            overlay.remove();
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    // === ЛОГИКА ДЛЯ SPA ===

    // Функция инициализации (запускается при загрузке и при переходе)
    function init() {
        console.log('[Helpdesk Catalog Search] Инициализация...');
        buttonCreated = false; // Сбрасываем флаг для новой страницы
        waitForElement('div[data-userscript-marker="commentFormTopControlsTypeSwitch/type-switch-marker"]', createTriggerButton);
    }

    // Запускаем при первой загрузке
    init();

    // Отслеживаем изменения URL для SPA-навигации
    let lastUrl = location.href;

    // Используем MutationObserver для отслеживания изменений в истории браузера
    const urlObserver = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('[Helpdesk Catalog Search] URL изменился:', url);

            // Проверяем, что мы всё ещё на странице тикета
            if (url.match(/\/helpdesk\/details\//)) {
                // Небольшая задержка, чтобы DOM успел обновиться
                setTimeout(init, 300);
            }
        }
    });

    urlObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Дополнительный способ: перехват pushState/replaceState (для некоторых SPA)
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
        console.log('[Helpdesk Catalog Search] pushstate detected');
        setTimeout(() => {
            if (location.href.match(/\/helpdesk\/details\//)) {
                init();
            }
        }, 300);
    });

    window.addEventListener('replacestate', () => {
        console.log('[Helpdesk Catalog Search] replacestate detected');
        setTimeout(() => {
            if (location.href.match(/\/helpdesk\/details\//)) {
                init();
            }
        }, 300);
    });

    // Отслеживаем событие popstate (кнопки назад/вперёд)
    window.addEventListener('popstate', () => {
        console.log('[Helpdesk Catalog Search] popstate detected');
        setTimeout(() => {
            if (location.href.match(/\/helpdesk\/details\//)) {
                init();
            }
        }, 300);
    });

})();
