# FocusFlow Web - Reglas de Desarrollo y Buenas Prácticas

Estas reglas son de cumplimiento obligatorio para cualquier cambio, mejora, respuesta o nueva funcionalidad en el proyecto **FocusFlow Web**.

---

## 1. Regla de Emojis (Única Excepción Permitida: Gota de Agua en Correo)
* **Prohibición General:** NUNCA usar emojis en respuestas al usuario, documentación, comentarios de código, interfaz gráfica, ni en otros correos o notificaciones.
* **Única Excepción Estricta:** El único emoji permitido en todo el sistema es el emoji de la gota de agua (`💧`), exclusivo para el mensaje y plantilla del correo de recordatorio de hidratación.

---

## 2. Confidencialidad y Privacidad Absoluta de Credenciales
* **Privacidad Estricta:** Las contraseñas de cuentas principales, accesos administrativos y credenciales maestras del usuario son de uso exclusivo y confidencial entre el usuario y el asistente.
* **Protección contra Fugas:** NUNCA incluir contraseñas maestras en archivos públicos, repositorios de código abierto, commits públicos ni compartirlas con terceros bajo ningún motivo.
* **Manejo Seguro:** Las variables de entorno con credenciales técnicas se gestionan de forma aislada en archivos locales `.env` protegidos por `.gitignore` y en los paneles seguros de producción en la nube.

---

## 3. Protocolo de Integridad Total y Cero Regresiones (Pre-Deploy Checklist)
* **Auditoría de Git Status:** Antes de cualquier despliegue o fusión a `main`, ejecutar `git status` para certificar que NO queden archivos modificados, esquemas o dependencias huérfanas en el árbol de trabajo local.
* **Verificación de Compilación Limpia:** Ejecutar siempre `npm run build` en el backend para validar que TypeScript compile con 0 errores y que el cliente de Prisma esté 100% generado y sincronizado con el esquema.
* **Pruebas de Humo Post-Despliegue (Smoke Tests):** Inmediatamente después de cada despliegue a Vercel, ejecutar verificaciones en vivo (`/api/health`, `/api/reminders/cron`) para comprobar que el entorno de producción esté verde y saludable.
* **Blindaje Integral:** Cuidar la estabilidad del sistema en todos sus frentes (frontend, backend, base de datos en Supabase, cron 24/7 y pasarela de correos) para prevenir roturas o fallos colaterales.

---

## 4. Flujo de Trabajo con Ramas Git (Git Branching)
* **Trabajar siempre en ramas secundarias:**  
  Todos los cambios, refactorizaciones o nuevas características deben desarrollarse en una rama secundaria (ej: `feat/nombre-funcion`, `fix/descripcion-error`, `refactor/modulo`).
* **Protección de `main`:**  
  NUNCA desarrollar ni hacer push directo a la rama `main` sin antes haber probado, validado y verificado la compilación en la rama secundaria.
* **Fusión Segura:**  
  Solo cuando la función esté 100% probada, libre de errores y compilada exitosamente, se procede a fusionar (*merge*) o promover a `main`.

---

## 5. Programación Defensiva Obligatoria
* **Manejo de Errores con `try/catch`:**  
  Toda operación asíncrona, consulta a base de datos (Prisma / Supabase), llamada a APIs externas (Gemini, Google OAuth) y envíos de correo (SMTP) DEBE estar encapsulada en bloques `try/catch` con logging detallado y respuestas de fallback seguras.
* **Encadenamiento Opcional y Valores por Defecto (`?.` y `??`):**  
  Usar siempre encadenamiento opcional (`user?.email`, `task?.category`) y operadores de coalescencia nula (`water_goal ?? 2000`) para evitar excepciones por valores `null` o `undefined`.
* **Validación de Entradas:**  
  Validar siempre tipos de datos, rangos horarios y correos antes de persistir en base de datos o despachar tareas en el cron.

---

## 6. Verificación de Compatibilidad Multiplataforma
* **Compatibilidad Multiplataforma:**  
  Verificar que los correos y componentes visuales mantengan alto contraste, adaptabilidad a pantallas móviles reducidas y compatibilidad completa con navegadores modernos.
