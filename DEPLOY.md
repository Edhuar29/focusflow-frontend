# 🚀 Guía de Publicación Gratuita en Internet ($0 USD)

Esta guía te explica cómo publicar **FocusFlow Web** en internet de forma **100% GRATIS** en **Render.com** (o Vercel / GitHub Pages).

---

## 🌟 Opción 1: Publicación Fullstack en Render.com ($0 / Plan Free)
* **Qué obtendrás**: Tu aplicación web completa con base de datos SQLite, API REST protegida y Asistente IA funcionando en un enlace público seguro como `https://focusflow-tu-nombre.onrender.com`.

### Pasos:

1. **Subir tu proyecto a GitHub**:
   * Abre tu terminal y ejecuta en la carpeta del proyecto:
     ```bash
     git init
     git add .
     git commit -m "FocusFlow Web - Release v1.0"
     git branch -M main
     git remote add origin https://github.com/TU-USUARIO/FocusFlowWeb.git
     git push -u origin main
     ```

2. **Crear cuenta en [Render.com](https://render.com/)**:
   * Inicia sesión con tu cuenta de GitHub (100% gratis, no pide tarjeta de crédito).

3. **Crear un nuevo "Web Service"**:
   * Haz clic en **New +** > **Web Service**.
   * Selecciona tu repositorio `FocusFlowWeb`.

4. **Configurar los ajustes del servicio**:
   * **Name**: `focusflow-web` (o el nombre que prefieras).
   * **Root Directory**: `backend`
   * **Environment**: `Node`
   * **Build Command**: `npm install && npm run prisma:generate && npm run build`
   * **Start Command**: `npm start`
   * **Instance Type**: `Free ($0/month)`

5. **Variables de Entorno (Environment Variables)**:
   * Agrega las siguientes variables en la sección *Environment Variables*:
     * `NODE_ENV` = `production`
     * `PORT` = `10000`
     * `DATABASE_URL` = `file:./dev.db`
     * `JWT_SECRET` = `tu_clave_secreta_segura_2026_xyz`
     * `GEMINI_API_KEY` = `(Opcional: Tu clave gratuita de Google AI Studio)`
     * `GEMINI_MODEL` = `gemini-1.5-flash`

6. **Desplegar**:
   * Haz clic en **Create Web Service**. En aproximadamente 2 minutos, Render compilará tu aplicación y te dará tu **enlace público gratuito HTTPS**.

---

## 🌐 Opción 2: Publicación Estática en Vercel / Netlify / GitHub Pages ($0)
Si solo deseas publicar la interfaz frontend:
* **Vercel**: Importa el repositorio y selecciona la raíz. Se publicará en `https://tu-proyecto.vercel.app`.
* **GitHub Pages**: En la configuración de tu repositorio en GitHub > **Pages** > selecciona la rama `main` y la carpeta `/ (root)`.

---

## 🛡️ Seguridad de tus Datos
* **Claves Ocultas**: Tu `GEMINI_API_KEY` y `JWT_SECRET` nunca son visibles para los usuarios que entren a la web.
* **HTTPS Gratuito**: Todo el tráfico entre los usuarios y tu página viaja encriptado de forma segura con certificados SSL automáticos.
