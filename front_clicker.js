(function() {
    const WEBHOOK_URL = 'https://your-webhook-url-here.com/endpoint';

    const container = document.querySelector('div.styles-module-root-oD3Gk');
    if (!container) {
        console.warn('Контейнер для кнопки автоклика не найден!');
        return;
    }

    if (container.querySelector('#auto-click-webhook-btn')) {
        return;
    }

    const btn = document.createElement('button');
    btn.id = 'auto-click-webhook-btn';
    btn.type = 'button';
    btn.innerHTML = '🚀 Автоклик';
    
    btn.style.cssText = `
        margin-left: 8px;
        padding: 4px 10px;
        background-color: rgb(0, 170, 255);
        color: rgb(255, 255, 255);
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
    `;

    btn.addEventListener('click', async () => {
        const data = {};

        // 1. Надежный поиск каталога (ищем любой текстовый блок или хлебные крошки/категорию сверху)
        const catalogElement = document.querySelector('span[class*="styles-module-size_s"]') || 
                               document.enciaribleXPath ? null : document.querySelector('h1 + div span, .breadcrumbs span, [data-marker*="category"]');
        
        // Если специфичный класс не сработал, попробуем найти текст каталога рядом с заголовком
        if (catalogElement) {
            data['catalog_name'] = catalogElement.textContent.trim();
        } else {
            // Запасной вариант: ищем по всему документу элементы похожие на категорию
            const potentialCatalog = Array.from(document.querySelectorAll('span')).find(el => el.textContent.includes('Экскаваторы') || el.textContent.includes('Погрузчики'));
            data['catalog_name'] = potentialCatalog ? potentialCatalog.textContent.trim() : 'Не найдено';
        }

        // 2. Метка модификации
        const modLabel = container.querySelector('[data-marker="modification-name/label"]');
        data['modification_label'] = modLabel ? modLabel.textContent.trim() : '';

        // 3. Все остальные параметры
        const paramItems = document.querySelectorAll('div.styles-module-param-RwXVL[data-marker="modification/param"]');
        paramItems.forEach(item => {
            const nameElement = item.querySelector('[data-marker="modification/param-name-link"]');
            const valueElements = item.querySelectorAll('[data-marker="modification/value-name-link"]');
            
            if (nameElement) {
                const paramName = nameElement.textContent.trim();
                const values = Array.from(valueElements).map(el => el.textContent.trim());
                data[paramName] = values.length > 1 ? values : (values[0] || '');
            }
        });

        console.log('Итоговые данные для отправки:', data);
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Отправка...';
        btn.style.backgroundColor = 'rgb(255, 140, 0)';

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                btn.innerHTML = '✅ Успешно!';
                btn.style.backgroundColor = 'rgb(40, 167, 69)';
            } else {
                throw new Error('Ошибка сервера: ' + response.status);
            }
        } catch (error) {
            console.error('Ошибка при отправке Webhook:', error);
            btn.innerHTML = '❌ Ошибка';
            btn.style.backgroundColor = 'rgb(220, 53, 69)';
        }

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.backgroundColor = 'rgb(0, 170, 255)';
        }, 2000);
    });

    container.appendChild(btn);
})();
