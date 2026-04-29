# EcoFlow Terminal

Plataforma de finanzas argentinas. Dashboard con cotizaciones de dólar en tiempo real, análisis de carry trade, calculadoras y más.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Vercel Serverless Functions (proxy a APIs externas)
- **Hosting**: Vercel
- **Datos**: dolarapi.com · criptoya.com

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Producción

Cualquier push a la rama `main` se deploya automáticamente a Vercel.

## Estructura

```
ecoflow/
├── api/              ← Serverless functions (proxies de APIs)
│   ├── dolares.js
│   ├── usdt.js
│   └── usdc.js
├── src/
│   ├── EcoFlowTerminal.jsx   ← Componente principal
│   ├── main.jsx              ← Entry point React
│   └── index.css             ← Tailwind directives
├── public/           ← Assets estáticos (favicon, etc)
├── index.html        ← Entry HTML
├── vite.config.js    ← Config Vite + proxy para dev local
├── vercel.json       ← Config deploy Vercel
└── package.json
```

## Variables de entorno

Por ahora no usamos. Cuando agreguemos APIs pagas (BCRA, Bloomberg, etc.) las cargamos en Vercel → Settings → Environment Variables.
