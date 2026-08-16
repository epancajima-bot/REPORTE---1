# GuÃ­a de VinculaciÃ³n: Base de Datos Google Sheets + GitHub Pages (REPORTE-1)

Esta guÃ­a explica el procedimiento paso a paso para desplegar la **Base de Datos Viva en Google Sheets** y conectar en tiempo real los formularios de campo alojados en GitHub Pages ([`https://epancajima-bot.github.io/REPORTE---1/`](https://epancajima-bot.github.io/REPORTE---1/)).

---

## ðŸŽ¯ Objetivo de la IntegraciÃ³n

Permitir que cuando el Tareador, Almacenero, Administradora o Ing. de Campo completen un reporte desde su telÃ©fono celular en GitHub Pages (`tareador.html`, `almacen.html`, etc.), los datos viajen por HTTP POST e inserten automÃ¡ticamente nuevas filas en la **PestaÃ±a `04_LOG_FIELD_ENTRIES`** de tu hoja de Google Sheets, ejecutando las fÃ³rmulas de P.U., Subtotal y EVM al instante.

---

## ðŸš€ PASO 1: Subir el Libro a tu Google Drive

1. Abre tu cuenta de Google Drive.
2. Sube el archivo Excel generado: [`Base_Datos_Proyecto_Sheets_Viva.xlsx`](file:///d:/Agentes%20de%20IA/Habilitaci%C3%B3n%20urbana/outputs/Base_Datos_Proyecto_Sheets_Viva.xlsx).
3. Haz doble clic en el archivo subido y selecciona **"Abrir con Google Sheets"**.
4. Haz clic en el menÃº **Archivo > Guardar como Hoja de cÃ¡lculo de Google** (Google Sheets nativo).

---

## âš™ï¸ PASO 2: Instalar y Desplegar el Google Apps Script (Backend)

1. En tu hoja de cÃ¡lculo de Google Sheets, ve al menÃº superior:  
   ðŸ‘‰ **Extensiones > Apps Script**
2. Borra todo el cÃ³digo que aparece por defecto.
3. Copia y pega todo el contenido del archivo [`scripts/google_apps_script.gs`](file:///d:/Agentes%20de%20IA/Habilitaci%C3%B3n%20urbana/scripts/google_apps_script.gs).
4. Guarda los cambios haciendo clic en el icono de disco ðŸ’¾ o presionando `Ctrl + S`.
5. Haz clic en el botÃ³n azul de la esquina superior derecha: **Desplegar > Nuevo despliegue**.
6. En la ventana emergente, configura exactamente los siguientes campos:
   - **Tipo de Despliegue**: Haz clic en el engranaje âš™ï¸ y selecciona **AplicaciÃ³n web**.
   - **DescripciÃ³n**: `API Reportabilidad de Campo REPORTE---1`
   - **Ejecutar como**: `Yo (tu_correo@gmail.com)`
   - **QuiÃ©n tiene acceso**: âš ï¸ **`Cualquier persona` (Anyone)**  
     *(Esta opciÃ³n es obligatoria para permitir que los celulares sin iniciar sesiÃ³n envÃ­en datos desde GitHub Pages)*.
7. Haz clic en **Desplegar**.
8. Acepta los permisos de seguridad de Google ("Avanzado" > "Ir a Proyecto sin tÃ­tulo (no seguro)").
9. Copia la **URL de la aplicaciÃ³n web** generada. TendrÃ¡ un formato como este:
   ```text
   https://script.google.com/macros/s/AKfycbx..._tu_token_aqui.../exec
   ```

---

## ðŸŒ PASO 3: Configurar la URL en GitHub Pages

Para conectar los portales HTML de tu sitio `https://epancajima-bot.github.io/REPORTE---1/` con la URL de tu Google Apps Script:

### OpciÃ³n A (ConfiguraciÃ³n Global DinÃ¡mica en JS)
En tu archivo JavaScript del sitio (`app.js`), la variable global con la URL activa de tu proyecto es:

```javascript
// ConfiguraciÃ³n de endpoint activa de Google Sheets en app.js
window.RO_API_ENDPOINT = "https://script.google.com/macros/s/AKfycbwecahQY_jC4kqtZiYkGSZKj5LRvgG4HHC1GOHUIvDF0obE6_kek_x8ebhZs_zd3Mp9/exec";
```

### OpciÃ³n B (Prueba RÃ¡pida desde Consola del Navegador)
Si estÃ¡s probando con tus alumnos en clase, pueden abrir la consola de su navegador (`F12`) en `https://epancajima-bot.github.io/REPORTE---1/` y ejecutar:

```javascript
localStorage.setItem('ro_api_endpoint', 'https://script.google.com/macros/s/AKfycbwecahQY_jC4kqtZiYkGSZKj5LRvgG4HHC1GOHUIvDF0obE6_kek_x8ebhZs_zd3Mp9/exec');
```

---

## ðŸ§ª PASO 4: Prueba de VerificaciÃ³n de Entrada de Datos

1. Abre desde tu celular o computadora el enlace:  
   ðŸ‘‰ [https://epancajima-bot.github.io/REPORTE---1/tareador.html](https://epancajima-bot.github.io/REPORTE---1/tareador.html)
2. Selecciona una WBS (ej. `WBS-200`), ingresa 2 operarios x 8 horas (16 HH) y haz clic en **Guardar Registros**.
3. Revisa tu pestaÃ±a **`04_LOG_FIELD_ENTRIES`** en Google Sheets:
   - Se crearÃ¡ inmediatamente una nueva fila.
   - El P.U. se buscarÃ¡ solo desde `05_MAESTRO_RECURSOS`.
   - El Subtotal se calcularÃ¡ con la fÃ³rmula viva `=ROUND(G*I, 2)`.
   - Las pestaÃ±as **`03_CONSOLIDADO_DIARIO_EVM_WBS`** y **`06_MAESTRO_PARTIDAS_EV`** actualizarÃ¡n automÃ¡ticamente el avance y los indicadores EVM ($SPI$ / $CPI$).
