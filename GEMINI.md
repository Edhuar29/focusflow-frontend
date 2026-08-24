# FocusFlow Web - Reglas de Desarrollo y Buenas Prácticas

Estas reglas son de cumplimiento obligatorio para cualquier cambio, mejora o nueva funcionalidad en el proyecto **FocusFlow Web**.

---

## 🌿 1. Flujo de Trabajo con Ramas Git (Git Branching)
* **Trabajar siempre en ramas secundarias:**  
  Todos los cambios, refactorizaciones o nuevas características deben desarrollarse en una rama secundaria (ej: `feat/nombre-funcion`, `fix/descripcion-error`, `refactor/modulo`).
* **Protección de `main`:**  
  NUNCA desarrollar ni hacer push directo a la rama `main` sin antes haber probado, validado y verificado la compilación en la rama secundaria.
* **Fusión Segura:**  
  Solo cuando la función esté 100% probada, libre de errores y compilada exitosamente, se procede a fusionar (*merge*) o promover a `main`.

---

## 🛡️ 2. Programación Defensiva Obligatoria
* **Manejo de Errores con `try/catch`:**  
  Toda operación asíncrona, consulta a base de datos (Prisma / Supabase), llamada a APIs externas (Gemini, Google OAuth) y envíos de correo (SMTP) DEBE estar encapsulada en bloques `try/catch` con logging detallado y respuestas de fallback seguras.
* **Encadenamiento Opcional y Valores por Defecto (`?.` y `??`):**  
  Usar siempre encadenamiento opcional (`user?.email`, `task?.category`) y operadores de coalescencia nula (`water_goal ?? 2000`) para evitar excepciones por valores `null` o `undefined`.
* **Validación de Entradas:**  
  Validar siempre tipos de datos, rangos horarios y correos antes de persistir en base de datos o despachar tareas en el cron.

---

## ⚙️ 3. Verificación de Compilación y Calidad
* **Compilación Previa:**  
  Antes de dar por concluida una tarea o preparar un despliegue, ejecutar siempre la compilación del backend (`npm run build` en `backend/`) para certificar que TypeScript compile con 0 errores y el cliente de Prisma esté sincronizado.
* **Compatibilidad Multiplataforma:**  
  Verificar que los correos y componentes visuales mantengan alto contraste y compatibilidad con modo oscuro en dispositivos móviles (iOS/Android) y computadoras.
