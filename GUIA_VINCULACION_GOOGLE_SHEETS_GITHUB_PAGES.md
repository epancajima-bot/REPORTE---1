# Guía de Vinculación: Base de Datos Google Sheets + GitHub Pages (REPORTE-1)

Esta guía explica el procedimiento paso a paso para desplegar la **Base de Datos Viva en Google Sheets** y conectar en tiempo real los formularios de campo alojados en GitHub Pages ([`https://epancajima-bot.github.io/REPORTE---1/`](https://epancajima-bot.github.io/REPORTE---1/)).

---

## 🎯 Objetivo de la Integración

Permitir que cuando el Tareador, Almacenero, Administradora o Ing. de Campo completen un reporte desde su teléfono celular en GitHub Pages (`tareador.html`, `almacen.html`, etc.), los datos viajen por HTTP POST e inserten automáticamente nuevas filas en la **Pestaña `04_LOG_FIELD_ENTRIES`** de tu hoja de Google Sheets, ejecutando las fórmulas de P.U., Subtotal y EVM al instante.

---

## 🚀 PASO 1: Subir el Libro a tu Google Drive

1. Abre tu cuenta de Google Drive.
2. Sube el archivo Excel generado: [`Base_Datos_Proyecto_Sheets_Viva.xlsx`](file:///d:/Agentes%20de%20IA/Habilitaci%C3%B3n%20urbana/outputs/Base_Datos_Proyecto_Sheets_Viva.xlsx).
3. Haz doble clic en el archivo subido y selecciona **"Abrir con Google Sheets"**.
4. Haz clic en el menú **Archivo > Guardar como Hoja de cálculo de Google** (Google Sheets nativo).

---

## ⚙️ PASO 2: Instalar y Desplegar el Google Apps Script (Backend)

1. En tu hoja de cálculo de Google Sheets, ve al menú superior:  
   👉 **Extensiones > Apps Script**
2. Borra todo el código que aparece por defecto.
3. Copia y pega todo el contenido del archivo [`scripts/google_apps_script.gs`](file:///d:/Agentes%20de%20IA/Habilitaci%C3%B3n%20urbana/scripts/google_apps_script.gs).
4. Guarda los cambios haciendo clic en el icono de disco 💾 o presionando `Ctrl + S`.
5. Haz clic en el botón azul de la esquina superior derecha: **Desplegar > Nuevo despliegue**.
6. En la ventana emergente, configura exactamente los siguientes campos:
   - **Tipo de Despliegue**: Haz clic en el engranaje ⚙️ y selecciona **Aplicación web**.
   - **Descripción**: `API Reportabilidad de Campo REPORTE-1`
   - **Ejecutar como**: `Yo (tu_correo@gmail.com)`
   - **Quién tiene acceso**: ⚠️ **`Cualquier persona` (Anyone)**  
     *(Esta opción es obligatoria para permitir que los celulares sin iniciar sesión envíen datos desde GitHub Pages)*.
7. Haz clic en **Desplegar**.
8. Acepta los permisos de seguridad de Google ("Avanzado" > "Ir a Proyecto sin título (no seguro)").
9. Copia la **URL de la aplicación web** generada. Tendrá un formato como este:
   ```text
   https://script.google.com/macros/s/AKfycbx..._tu_token_aqui.../exec
   ```

---

## 🌐 PASO 3: Configurar la URL en GitHub Pages

Para conectar los portales HTML de tu sitio `https://epancajima-bot.github.io/REPORTE---1/` con la URL de tu Google Apps Script:

### Opción A (Configuración Global Dinámica en JS)
En tu archivo JavaScript del sitio (`app.js`), la variable global con la URL activa de tu proyecto es:

```javascript
// Configuración de endpoint activa de Google Sheets en app.js
window.RO_API_ENDPOINT = "https://script.google.com/macros/s/AKfycbycOxMRY83hp6SU185I942sojJ-UieDEsRzaFP3VfhjJ5vIZ0WFjUj5Vt__5YCeR4tD/exec";
```

### Opción B (Prueba Rápida desde Consola del Navegador)
Si estás probando con tus alumnos en clase, pueden abrir la consola de su navegador (`F12`) en `https://epancajima-bot.github.io/REPORTE---1/` y ejecutar:

```javascript
localStorage.setItem('ro_api_endpoint', 'https://script.google.com/macros/s/AKfycbycOxMRY83hp6SU185I942sojJ-UieDEsRzaFP3VfhjJ5vIZ0WFjUj5Vt__5YCeR4tD/exec');
```

---

## 🧪 PASO 4: Prueba de Verificación de Entrada de Datos

1. Abre desde tu celular o computadora el enlace:  
   👉 [https://epancajima-bot.github.io/REPORTE---1/tareador.html](https://epancajima-bot.github.io/REPORTE---1/tareador.html)
2. Selecciona una WBS (ej. `WBS-200`), ingresa 2 operarios x 8 horas (16 HH) y haz clic en **Guardar Registros**.
3. Revisa tu pestaña **`04_LOG_FIELD_ENTRIES`** en Google Sheets:
   - Se creará inmediatamente una nueva fila.
   - El P.U. se buscará solo desde `05_MAESTRO_RECURSOS`.
   - El Subtotal se calculará con la fórmula viva `=ROUND(G*I, 2)`.
   - Las pestañas **`03_CONSOLIDADO_DIARIO_EVM_WBS`** y **`06_MAESTRO_PARTIDAS_EV`** actualizarán automáticamente el avance y los indicadores EVM ($SPI$ / $CPI$).
