# 🚀 Guía de Despliegue Desacoplado (2 Proyectos Independientes en Vercel)

Esta guía te explica paso a paso cómo subir y desplegar el **Frontend** y el **Backend** como dos proyectos independientes en **GitHub y Vercel (100% GRATIS $0 USD, 24/7 sin hibernación)**.

---

## 📌 Paso 1: Crear tus 2 Repositorios en GitHub

1. Entra a [github.com/new](https://github.com/new) e inicia sesión.
2. Crea el primer repositorio para el Frontend:
   * **Repository name**: `focusflow-frontend`
   * **Visibilidad**: `Public` (Público)
   * *No marques README ni .gitignore* -> Haz clic en **Create repository**.
3. Vuelve a entrar a [github.com/new](https://github.com/new) y crea el segundo repositorio para el Backend:
   * **Repository name**: `focusflow-backend`
   * **Visibilidad**: `Private` (Recomendado para proteger tu lógica) o `Public`.
   * Haz clic en **Create repository**.

---

## 📌 Paso 2: Subir el Backend a su Repositorio

Abre tu terminal en tu Mac y ejecuta:

```bash
# 1. Entrar a la carpeta del backend
cd /Users/panchis/Documents/FocusFlowWeb/backend

# 2. Inicializar Git en el backend
git init
git add .
git commit -m "Initial commit: FocusFlow REST API Backend"
git branch -M main

# 3. Vincular con tu repositorio de GitHub (reemplaza TU-USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU-USUARIO/focusflow-backend.git
git push -u origin main
```

---

## 📌 Paso 3: Desplegar el Backend en Vercel ($0)

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New...** > **Project**.
3. Selecciona el repositorio `focusflow-backend` y haz clic en **Import**.
4. En **Environment Variables**, añade:
   * `NODE_ENV` = `production`
   * `JWT_SECRET` = `tu_clave_secreta_super_segura_2026`
   * `DATABASE_URL` = `file:./dev.db`
   * `CORS_ORIGIN` = `*` (o la URL de tu frontend más adelante)
   * `GEMINI_API_KEY` = `(Tu API Key gratuita de Google AI Studio si la tienes)`
5. Haz clic en **Deploy**.
6. **¡Listo!** Vercel te dará la URL de tu API (ejemplo: `https://focusflow-backend.vercel.app`).
   * *Tu endpoint base será*: `https://focusflow-backend.vercel.app/api`.

---

## 📌 Paso 4: Configurar y Subir el Frontend

1. Abre el archivo `js/config.js` en tu frontend y actualiza la URL con la que te dio Vercel en el Paso 3:
   ```javascript
   export const CONFIG = {
     API_BASE_URL: 'https://focusflow-backend.vercel.app/api', // Tu URL de Vercel
   };
   ```

2. Sube el Frontend a su repositorio desde la terminal:
   ```bash
   # 1. Volver a la carpeta raíz del Frontend
   cd /Users/panchis/Documents/FocusFlowWeb

   # 2. Inicializar Git en el Frontend (ignorando la subcarpeta backend)
   git init
   git add index.html css/ js/ DEPLOY.md DEPLOY_DECOUPLED.md
   git commit -m "Initial commit: FocusFlow Web Client SPA"
   git branch -M main

   # 3. Vincular con tu repositorio del Frontend
   git remote add origin https://github.com/TU-USUARIO/focusflow-frontend.git
   git push -u origin main
   ```

---

## 📌 Paso 5: Desplegar el Frontend en Vercel ($0)

1. En Vercel, haz clic nuevamente en **Add New...** > **Project**.
2. Selecciona `focusflow-frontend` y haz clic en **Deploy**.
3. **¡Completado!** Vercel te entregará tu dominio oficial: `https://focusflow-frontend.vercel.app`.

---

## 🛡️ ¿Qué acabas de lograr como estudiante de CS?
* **Arquitectura de 2 Capas Profesional**: Separación total de cliente (Frontend) y servidor (Backend).
* **CERO Costo ($0 USD)** y **24/7 Siempre Activo**: Cero cold starts, carga en menos de 0.2 segundos y disponibilidad global en el Edge.
