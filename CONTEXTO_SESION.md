# Contexto de sesión — PMetrGRD Dashboard
**Fecha:** 2026-03-27
**Proyecto:** Tablero de seguimiento del Plan Metropolitano de Gestión del Riesgo de Desastres — Área Metropolitana del Valle de Aburrá

---

## ¿Qué es el proyecto?

Aplicación web SPA (Single Page Application) que permite hacer seguimiento a las 242 actividades del PMetrGRD (2019–2031). Tiene 4 vistas: Landing, El Plan, Componente Programático (dashboard + árbol + kanban), y está conectada a Firebase Realtime Database para sincronización en equipo.

---

## Archivos del proyecto

**Ubicación actual:** `C:\Users\User\PMGRD Pagina\`
**Archivo original (respaldo):** `C:\Users\User\OneDrive\Desktop\Con el plan.html` (270 KB, monolítico)

```
PMGRD Pagina/
├── index.html          (37 KB)  — HTML limpio
├── css/
│   └── styles.css      (37 KB)  — Todo el CSS
├── js/
│   ├── data.js         (117 KB) — Datos del plan + constantes
│   └── app.js          (62 KB)  — Toda la lógica JS
└── assets/
    └── logo.png        (18 KB)  — Logo AMVA
```

---

## Qué se hizo en esta sesión

| Tarea | Estado |
|---|---|
| Revisar el archivo original | ✅ |
| Separar CSS a `css/styles.css` | ✅ |
| Extraer datos a `js/data.js` | ✅ |
| Crear `js/app.js` con toda la lógica | ✅ |
| Extraer logo base64 → `assets/logo.png` | ✅ |
| **Bug fix:** función `clearAllResps` faltaba, implementada | ✅ |
| **Bug fix:** `OBJ_COL`/`PROC_COL` duplicados eliminados | ✅ |
| **Bug fix:** fuente DM Sans usada correctamente en `body` | ✅ |
| **Mejora:** `localStorage` agregado como persistencia offline | ✅ |
| Firebase sigue conectado (config intacta) | ✅ |
| Subir a GitHub | ❌ **PENDIENTE** |

---

## Firebase — configuración (en `js/app.js` línea ~1236)

```javascript
const FIREBASE_CFG = {
  apiKey: "AIzaSyDDgCRCz2YaZuL5vyWO581aYGfppZmNQKw",
  authDomain: "pmetrgrd-amva.firebaseapp.com",
  databaseURL: "https://pmetrgrd-amva-default-rtdb.firebaseio.com",
  projectId: "pmetrgrd-amva",
  storageBucket: "pmetrgrd-amva.firebasestorage.app",
  messagingSenderId: "507075477075",
  appId: "1:507075477075:web:8e6c67589b28bf191290a6"
};
```

- Nodo en la base de datos: `plan/data`
- La app carga datos desde Firebase al inicio; si no hay conexión, usa `localStorage` (clave: `pmetrgrd_v2`)

---

## localStorage — cómo funciona

- Se guarda automáticamente en **cada edición de actividad** y cada vez que se presiona "Publicar cambios"
- Si Firebase tarda >6 segundos en conectar, carga desde `localStorage`
- Si no hay nada en `localStorage`, usa los datos base de `RAW` en `data.js`
- Para limpiar el caché local abrir consola del navegador y ejecutar: `localStorage.removeItem('pmetrgrd_v2')`

---

## Pendiente para mañana — GitHub

### Lo que hay que decidir antes de empezar:
1. **¿Ya existe un repositorio en GitHub?**
   - Si sí → necesito la URL (`https://github.com/usuario/repo`)
   - Si no → puedo crearlo con `gh repo create` (requiere GitHub CLI instalado)

2. **¿Quieres GitHub Pages?**
   - Haría el sitio accesible en `https://usuario.github.io/repo-name/`
   - Solo requiere activar Pages en settings del repo apuntando a `main` branch

3. **¿El repo debe ser público o privado?**
   - Nota: el repo contiene la API key de Firebase — si es público, la key queda expuesta. Firebase permite restringir las keys por dominio desde la consola de Google Cloud.

### Pasos que haré una vez confirmado:
```bash
cd "C:\Users\User\PMGRD Pagina"
git init
git add index.html css/ js/ assets/
git commit -m "feat: refactor a estructura multi-archivo con localStorage"
git remote add origin https://github.com/USUARIO/REPO.git
git push -u origin main
```

---

## Estructura de los datos (para entender `data.js`)

```
RAW = [
  { id: "OBJ1", title: "Mejorar el Conocimiento del Riesgo", proceso: "Conocimiento",
    estrategias: [
      { id: "E1", title: "...", programas: [
        { id: "P01", title: "...", proyectos: [
          { id: "p001", title: "...", actividades: [
            { id: "A0001", title: "...", indicador: "...",
              meta: 1, ejecutado: 1, pct: 100.0,
              descripcion: "", responsable: "SGC",
              plazo: "ND", notas: "" }
          ]}
        ]}
      ]}
    ]
  },
  { id: "OBJ2", proceso: "Reducción", ... },   // actividades A0133–A0164
  { id: "OBJ3", proceso: "Manejo", ... },       // actividades A0165–A0217
  { id: "OBJ4", proceso: "Gobernanza", ... }    // actividades A0218–A0242
]
```

**Totales:** 4 objetivos · 8 estrategias · 20 programas · ~40 proyectos · **242 actividades**

---

## Notas técnicas importantes

- El archivo original usa `\n` (LF) internamente; los archivos extraídos con PowerShell pueden tener `\r\n` (CRLF) — no afecta al navegador
- Los emojis y caracteres especiales (á, é, ó, ú, ñ) están correctamente codificados en UTF-8 en todos los archivos
- El proyecto **no usa ningún framework** — vanilla HTML/CSS/JS puro
- El donut animado usa Canvas API nativa (no Chart.js ni D3)
- El Excel se genera con un builder OOXML/ZIP completamente en JavaScript (sin librerías externas)
- Firebase se carga dinámicamente con `loadScript()` — si falla 3 veces, entra en modo local

---

## Cómo probar localmente

Abrir `C:\Users\User\PMGRD Pagina\index.html` directamente en el navegador.
No requiere servidor local — funciona como archivo estático.
La conexión a Firebase funciona desde `file://` siempre que el dominio esté autorizado en Firebase Console.
