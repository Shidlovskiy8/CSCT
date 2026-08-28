(function() {
    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25';

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

        // 1. Добавляем каталог на самый верх объекта
        const catalogElement = document.querySelector('div[data-marker="main-catalog-title"] span');
        data['catalog_name'] = catalogElement ? catalogElement.textContent.trim() : '';

        // 2. Метка модификации
        const modLabel = container.querySelector('[data-marker="modification-name/label"]');
        data['modification_label'] = modLabel ? modLabel.textContent.trim() : '';

        // 3. Остальные параметры
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

        console.log('Собранные данные для отправки:', data);
        
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
