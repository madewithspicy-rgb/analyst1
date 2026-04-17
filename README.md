# Spicy Media — Site Analyzer

Инструмент для анализа лендингов и генерации рекомендаций по конверсии.

## Структура проекта

```
spicy-analyzer/
├── netlify/
│   └── functions/
│       └── analyze.js      ← серверный код (API ключ хранится здесь, безопасно)
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── netlify.toml
└── package.json
```

## Деплой на Netlify (5 минут)

### 1. Залить на GitHub
```bash
cd spicy-analyzer
git init
git add .
git commit -m "init"
git remote add origin https://github.com/ВАШ_АККАУНТ/spicy-analyzer.git
git push -u origin main
```

### 2. Подключить к Netlify
1. Зайдите на https://app.netlify.com
2. "Add new site" → "Import an existing project"
3. Выберите ваш GitHub репозиторий
4. Build settings оставьте пустыми (статика + functions)
5. Нажмите "Deploy site"

### 3. Добавить API ключ (ОБЯЗАТЕЛЬНО)
1. В Netlify → ваш сайт → **Site configuration** → **Environment variables**
2. Нажмите "Add a variable"
3. Key: `ANTHROPIC_API_KEY`
4. Value: `sk-ant-...` (ваш ключ с https://console.anthropic.com)
5. Нажмите "Save"
6. **Redeploy** сайт (Deploys → Trigger deploy)

### Готово!
Сайт будет доступен по адресу `https://ВАШ-САЙТ.netlify.app`

## Как работает безопасность
- API ключ хранится только в переменных окружения Netlify (server-side)
- Фронтенд никогда не видит ключ — он не попадает в HTML/JS
- Все запросы к Anthropic идут через `netlify/functions/analyze.js`
- В браузере пользователя нет никакого ключа

## Что умеет сервис
- Автоматически заходит на сайт клиента и читает его содержимое
- Определяет нишу, ЦА, тон, ключевую ценность — без ручного заполнения
- Загрузка базы знаний по клиенту (бриф, CRM-выгрузка, заметки) — PDF, TXT, DOCX
- Генерирует 5–10 конкретных правок по регламенту Spicy Media
- Пишет тексты на американском английском с нуля
- Формирует список задач по ролям: PM / Designer / Developer
- Скачать результат в .txt
