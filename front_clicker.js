// front_clicker.js
(function() {
    'use strict';

    const WEBHOOK_URL = 'https://bpa-n8n-stage.k.avito.ru/webhook/d1022c79-45b8-4971-9712-53ccd03cbd25';
    const BUTTON_ID = 'Автокликер';

    function extractCarParameters() {
        const data = {};
        const paramRows = document.querySelectorAll('div[data-marker="modification/param"]');

        paramRows.forEach(row => {
            const nameEl = row.querySelector('a[data-marker="modification/param-name-link"]');
            const valueEls = row.querySelectorAll('a[data-marker="modification/value-name-link"]');

            if (nameEl) {
                const paramName = nameEl.textContent.trim();
                const values = Array.from(valueEls).map(el => el.textContent.trim());

                data[paramName] = values.length === 1 ? values[0] : values;
            }
        });

        return data;
    }

    function createButton() {
        const container = document.querySelector('div.styles-module-root-oD3Gk');
        if (!container || document.getElementById(BUTTON_ID)) return;

        const webhookBtn = document.createElement('button');
        webhookBtn.id = BUTTON_ID;
        webhookBtn.type = 'button';
        webhookBtn.className = 'styles-module-root-ACGSH styles-module-root_size_xs-GpxKs styles-module-root_preset_secondary-px9Qj styles-module-root_shape_square-kSmSL';
        webhookBtn.style.marginLeft = '8px';
        webhookBtn.title = 'Отправить на вебхук';
        
        webhookBtn.innerHTML = `
            <span class="styles-module-wrapper-s_rT_">
                <span class="styles-module-text-HOhq6 styles-module-text_size_xs-l0ff7">
                    Webhook
                </span>
            </span>
        `;

        webhookBtn.addEventListener('click', async () => {
            const carData = extractCarParameters();
            
            try {
                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(carData)
                });

                if (response.ok) {
                    alert('Данные успешно отправлены по вебхуку!');
                } else {
                    alert('Ошибка отправки: ' + response.statusText);
                }
            } catch (error) {
                console.error('Webhook error:', error);
                alert('Ошибка сети при отправке вебхука.');
            }
        });

        container.appendChild(webhookBtn);
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('div.styles-module-root-oD3Gk') && !document.getElementById(BUTTON_ID)) {
            createButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButton);
    } else {
        createButton();
    }
})();
