// ==============================================================================
// GOOGLE APPS SCRIPT - CONECTOR DE BASE DE DATOS VIVA EN GOOGLE SHEETS  (v2.0)
// Proyecto : Redes Sanitarias de Agua Potable y Alcantarillado
// Vinculado: https://epancajima-bot.github.io/REPORTE---1/
// Objetivo : Recibir los reportes de los portales HTML (tareador, almacenero,
//            administradora, ing_campo) y escribir filas en la pestaña 04,
//            con P.U. y Subtotal calculados por fórmulas vivas de Google Sheets.
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. CONFIGURACIÓN CENTRAL  (ajusta estos valores antes de desplegar)
// ------------------------------------------------------------------------------

var CONFIG = {
  // Si lo dejas en null, el script usará la hoja de cálculo ACTIVA desde la que
  // abriste Apps Script (Extensiones > Apps Script). También puedes forzar una
  // URL o ID específico: "https://docs.google.com/spreadsheets/d/XXXX/edit"
  spreadSheetIdOrUrl: "https://docs.google.com/spreadsheets/d/1nlN-U7iJFBlGNS-q0xBxSzJWSDI2uMr_dCZ2eU6W3hE/edit",

  // Pestaña donde se insertan los reportes de campo (04_LOG_FIELD_ENTRIES)
  tabLogs: "04_LOG_FIELD_ENTRIES",

  // Maestros de donde el VLOOKUP toma el Precio Unitario
  tabRecursos     : "05_MAESTRO_RECURSOS",
  tabPartidas     : "06_MAESTRO_PARTIDAS_EV",

  // URL raíz de la página publicada en GitHub Pages
  ghPagesUrl: "https://epancajima-bot.github.io/REPORTE---1/",

  // Zona horaria para interpretar las fechas
  timeZone: "America/Lima"
};

// ------------------------------------------------------------------------------
// 2. INSTALACIÓN DE MENÚ EN GOOGLE SHEETS (opcional, facilita la prueba)
// ------------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📊 ReporteSmart v2")
    .addItem("1. Probar conexión", "probarConexion")
    .addSeparator()
    .addItem("2. Forzar autorización", "forzarAutorizacion")
    .addSeparator()
    .addItem("3. Importar base sintética (GitHub)", "importarBaseSinteticaDesdeGithub")
    .addToUi();
}

// ------------------------------------------------------------------------------
// 3. ACCESO A LA HOJA DE CÁLCULO
// ------------------------------------------------------------------------------

function getSpreadsheet() {
  var target = CONFIG.spreadSheetIdOrUrl || SPREADSHEET_ID_OR_URL || null;
  try {
    if (target) {
      return String(target).indexOf("https://") === 0
        ? SpreadsheetApp.openByUrl(String(target))
        : SpreadsheetApp.openById(String(target));
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    console.error("Error al obtener hoja:", err);
  }
  return null;
}

function getOrCreateLogsSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.tabLogs);
  if (sheet) return sheet;
  sheet = ss.insertSheet(CONFIG.tabLogs);
  sheet.appendRow([
    "ID Registro", "Fecha", "Rol Responsable", "Código WBS",
    "Código Recurso/Partida", "Descripción / Detalle", "Cantidad Campo",
    "Unidad", "P.U. (Busca en Maestro)", "Subtotal Monto (S/)",
    "Categoría EVM", "Origen HTML"
  ]);
  return sheet;
}

// ------------------------------------------------------------------------------
// 4. ENDPOINT POST - EL PORTAL HTML ENVÍA AQUÍ LOS REPORTES
// ------------------------------------------------------------------------------
// Contrato JSON esperado (según auditoría de alineación HTML <-> Sheets):
//   { fecha, rol, wbs, codigoRecurso, detalle, cantidad, unidad, tipo, origen_html }
// Puede recibir un objeto o un array de objetos.

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: "ERROR", message: "Payload JSON no recibido" });
    }

    var rawContent = JSON.parse(e.postData.contents);
    var records = Array.isArray(rawContent) ? rawContent : [rawContent];
    if (records.length === 0) {
      return responseJSON({ status: "ERROR", message: "El payload no contiene registros." });
    }

    var ss = getSpreadsheet();
    if (!ss) {
      return responseJSON({
        status: "ERROR",
        message: "No se pudo acceder a la hoja de cálculo. Revisa CONFIG.spreadSheetIdOrUrl."
      });
    }

    var sheet = getOrCreateLogsSheet(ss);

    // Secuencia del siguiente ID LOG-YYYYMMDD-XXX
    var todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    var nextNum = 1;
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var r = ids.length - 1; r >= 0; r--) {
        var currId = String(ids[r][0] || "");
        if (currId.indexOf("LOG-") === 0) {
          var parts = currId.split("-");
          if (parts.length === 3) {
            var num = parseInt(parts[2], 10);
            if (!isNaN(num)) { nextNum = num + 1; break; }
          }
        }
      }
    }

    var insertedCount = 0;
    var errores = [];

    for (var i = 0; i < records.length; i++) {
      var data = records[i] || {};
      var currentRow = lastRow + i + 1;

      // Construir ID correlativo LOG-YYYYMMDD-XXX
      var numStr = String(nextNum);
      while (numStr.length < 3) { numStr = "0" + numStr; }
      var idVal = "LOG-" + todayStr + "-" + numStr;
      nextNum++;

      var fechaVal  = data.fecha  || new Date().toISOString().split("T")[0];
      var rolVal    = data.rol    || data.emisor_rol || "Sin Rol";
      var wbsVal    = data.wbs    || data.wbs_codigo || "WBS-100";

      // Forzar texto para códigos numéricos ("01.02.02") y evitar que Sheets
      // convierta a decimal (1.02) y rompa el VLOOKUP.
      var codVal = String(data.codigoRecurso || data.codigo_recurso_partida || "MO_PEON");
      if (codVal.match(/^\d+(\.\d+)+$/) || !isNaN(codVal)) {
        codVal = "'" + codVal;
      }

      var detVal  = data.detalle || data.descripcion || "";
      var cantVal = Number(data.cantidad) || 0.0;
      var undVal  = data.unidad || "und";
      var catVal  = data.tipo   || data.categoria_evm || "AC_MO";
      var origVal = data.origen_html || (data.rol === "Tareador (Bildin)" ? "tareador.html" : "almacenero.html");

      sheet.appendRow([
        idVal, fechaVal, rolVal, wbsVal, codVal, detVal, cantVal, undVal,
        "", "", catVal, origVal
      ]);

      // Centrar columnas A, D, E y H
      sheet.getRange(currentRow, 1).setHorizontalAlignment("center");
      sheet.getRange(currentRow, 4).setHorizontalAlignment("center");
      sheet.getRange(currentRow, 5).setHorizontalAlignment("center");
      sheet.getRange(currentRow, 8).setHorizontalAlignment("center");

      // P.U. : busca en 05_MAESTRO_RECURSOS (col D) o en 06_MAESTRO_PARTIDAS_EV (col F)
      var rangePU = sheet.getRange(currentRow, 9);
      rangePU.setFormula(
        "=IFERROR(VLOOKUP(E" + currentRow + ", '" + CONFIG.tabRecursos + "'!A:D, 4, FALSE), " +
        "IFERROR(VLOOKUP(E" + currentRow + ", '" + CONFIG.tabPartidas + "'!B:F, 5, FALSE), 0))"
      );
      rangePU.setNumberFormat("S/ #,##0.00");

      // Subtotal = Cantidad * P.U.
      var rangeSubtotal = sheet.getRange(currentRow, 10);
      rangeSubtotal.setFormula("=ROUND(G" + currentRow + " * I" + currentRow + ", 2)");
      rangeSubtotal.setNumberFormat("S/ #,##0.00");

      insertedCount++;
    }

    return responseJSON({
      status: "SUCCESS",
      message: "Se insertaron " + insertedCount + " registro(s) en la pestaña '" + CONFIG.tabLogs + "'.",
      count: insertedCount,
      errores: errores,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return responseJSON({
      status: "ERROR",
      message: "Error al procesar registro en Google Sheets: " + error.toString()
    });
  }
}

// ------------------------------------------------------------------------------
// 5. ENDPOINT GET - EL DASHBOARD LEE LOS REGISTROS Y EL CONSOLIDADO EVM
// ------------------------------------------------------------------------------

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) {
      return responseJSON({ status: "ERROR", message: "No se pudo acceder a la hoja de cálculo." });
    }

    // --- 5.1 Leer pestaña 04 (logs de campo) -------------------------------
    var logsData = [];
    var sheetLogs = ss.getSheetByName(CONFIG.tabLogs);
    if (sheetLogs) {
      var lastRowLogs = sheetLogs.getLastRow();
      if (lastRowLogs >= 2) {
        var valuesLogs = sheetLogs.getRange(2, 1, lastRowLogs - 1, 12).getValues();
        for (var i = 0; i < valuesLogs.length; i++) {
          var row = valuesLogs[i];
          if (!row[0] && !row[4]) continue;

          var fechaVal = row[1];
          if (fechaVal instanceof Date) {
            fechaVal = Utilities.formatDate(fechaVal, CONFIG.timeZone, "yyyy-MM-dd");
          } else if (fechaVal) {
            fechaVal = String(fechaVal).split("T")[0];
          }

          logsData.push({
            id: String(row[0] || ""),
            fecha: String(fechaVal || ""),
            rol: String(row[2] || ""),
            wbs: String(row[3] || ""),
            codigoRecurso: String(row[4] || ""),
            detalle: String(row[5] || ""),
            cantidad: Number(row[6]) || 0,
            unidad: String(row[7] || ""),
            pu: Number(row[8]) || 0,
            costo: Number(row[9]) || 0,
            tipo: String(row[10] || ""),
            origen_html: String(row[11] || "")
          });
        }
      }
    }

    // --- 5.2 Leer pestaña 03 (consolidado diario EVM por WBS) --------------
    var consolidadoData = [];
    var sheetCons = ss.getSheetByName("03_CONSOLIDADO_DIARIO_EVM_WBS");
    if (sheetCons) {
      var lastRowCons = sheetCons.getLastRow();
      if (lastRowCons >= 2) {
        var valuesCons = sheetCons.getRange(2, 1, lastRowCons - 1, 12).getValues();
        for (var j = 0; j < valuesCons.length; j++) {
          var rowC = valuesCons[j];
          if (!rowC[1] || !rowC[2]) continue;

          var fechaCVal = rowC[1];
          if (fechaCVal instanceof Date) {
            fechaCVal = Utilities.formatDate(fechaCVal, CONFIG.timeZone, "yyyy-MM-dd");
          } else if (fechaCVal) {
            fechaCVal = String(fechaCVal).split("T")[0];
          }

          consolidadoData.push({
            dia: Number(rowC[0]) || 0,
            fecha: String(fechaCVal || ""),
            wbs: String(rowC[2] || ""),
            descripcion: String(rowC[3] || ""),
            bac: Number(rowC[4]) || 0,
            pv_diario: Number(rowC[5]) || 0,
            pv_acumulado: Number(rowC[6]) || 0,
            ev_diario: Number(rowC[7]) || 0,
            ev_acumulado: Number(rowC[8]) || 0,
            ac_diario: Number(rowC[9]) || 0,
            ac_acumulado: Number(rowC[10]) || 0,
            variacion: Number(rowC[11]) || 0
          });
        }
      }
    }

    return responseJSON({
      status: "SUCCESS",
      version: "2.0.0",
      proyecto: "Redes Sanitarias de Agua Potable y Alcantarillado",
      gh_pages: CONFIG.ghPagesUrl,
      logs: logsData,
      consolidado: consolidadoData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return responseJSON({
      status: "ERROR",
      message: "Error en doGet: " + error.toString()
    });
  }
}

// ------------------------------------------------------------------------------
// 6. AUXILIARES
// ------------------------------------------------------------------------------

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- 6.1 Prueba de conexión y permisos de escritura --------------------------

function probarConexion() {
  var ss = getSpreadsheet();
  if (!ss) {
    Logger.log("❌ No se pudo conectar a la hoja de cálculo.");
    return;
  }
  Logger.log("✅ Conexión exitosa al Google Sheet: " + ss.getName());

  var sheet = ss.getSheetByName(CONFIG.tabLogs);
  if (sheet) {
    Logger.log("✅ Pestaña '" + CONFIG.tabLogs + "' encontrada con " + sheet.getLastRow() + " filas.");
    try {
      var tempRange = sheet.getRange("Z1");
      tempRange.setValue("TEST_WRITE");
      tempRange.clearContent();
      Logger.log("✅ Permiso de ESCRITURA confirmado.");
    } catch (writeErr) {
      Logger.log("❌ ERROR DE ESCRITURA: revisa que tu cuenta tenga permisos de Editor. Detalle: " + writeErr.toString());
    }
  } else {
    Logger.log("⚠️ La pestaña '" + CONFIG.tabLogs + "' se creará automáticamente con el primer POST.");
  }
}

// --- 6.2 Forzar la ventana de permisos de Google -----------------------------

function forzarAutorizacion() {
  var ss = getSpreadsheet();
  if (ss) {
    Logger.log("✅ Documento abierto con éxito: " + ss.getName());
    Logger.log("ℹ️ URL para copiar y desplegar: " + CONFIG.ghPagesUrl);
    return;
  }
  Logger.log("❌ Revisa CONFIG.spreadSheetIdOrUrl.");
}

// --- 6.3 Importar la base sintética desde GitHub Pages ------------------------

function importarBaseSinteticaDesdeGithub() {
  var url = CONFIG.ghPagesUrl + "data/base_datos_reportabilidad.json";
  Logger.log("📥 Descargando base de datos sintética desde: " + url);

  try {
    var response = UrlFetchApp.fetch(url);
    var json = JSON.parse(response.getContentText());
    var logs = json.registros_diarios;

    if (!logs || logs.length === 0) {
      Logger.log("❌ No se encontraron registros en el JSON.");
      return;
    }

    Logger.log("✅ Se descargaron " + logs.length + " registros.");

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.tabLogs);
    if (!sheet) {
      Logger.log("❌ Pestaña '" + CONFIG.tabLogs + "' no encontrada.");
      return;
    }

    // 1. Limpiar registros antiguos
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.deleteRows(2, lastRow - 1);
    }
    Logger.log("🧹 Pestaña '" + CONFIG.tabLogs + "' limpiada.");

    // 2. Preparar filas con fórmulas vivas
    var rowsToWrite = [];
    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];
      var dateParts = String(log.fecha).split("-");
      var dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));

      var rowNum = i + 2;
      var formulaPU = "=IFERROR(VLOOKUP(E" + rowNum + "; '" + CONFIG.tabRecursos + "'!A:D; 4; FALSE); IFERROR(VLOOKUP(E" + rowNum + "; '" + CONFIG.tabPartidas + "'!B:F; 5; FALSE); 0))";
      var formulaCosto = "=ROUND(G" + rowNum + " * I" + rowNum + "; 2)";

      rowsToWrite.push([
        log.id_registro || log.id,
        dateObj,
        log.rol,
        log.wbs,
        log.codigoRecurso || log.codigo_recurso_partida,
        log.detalle || log.descripcion,
        Number(log.cantidad) || 0,
        log.unidad,
        formulaPU,
        formulaCosto,
        log.tipo || log.categoria_evm,
        log.origen_html
      ]);
    }

    // 3. Escribir todas las filas en un solo bloque (rápido)
    var range = sheet.getRange(2, 1, rowsToWrite.length, 12);
    range.setValues(rowsToWrite);

    // 4. Formato
    sheet.getRange(2, 2, rowsToWrite.length, 1).setNumberFormat("yyyy-mm-dd");
    sheet.getRange(2, 1, rowsToWrite.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 4, rowsToWrite.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 5, rowsToWrite.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 8, rowsToWrite.length, 1).setHorizontalAlignment("center");

    Logger.log("🚀 ¡Importación completada! Se insertaron " + rowsToWrite.length + " filas.");
  } catch (error) {
    Logger.log("❌ Error en la importación: " + error.toString());
  }
}

// ------------------------------------------------------------------------------
// 7. (OPCIONAL) AUTO-CREACIÓN DE PESTAÑAS MAESTRAS SI NO EXISTEN
// ------------------------------------------------------------------------------
// Si tu hoja es nueva y aún no tiene 05/06, ejecuta esta función UNA vez desde el
// editor (botón Ejecutar) para sembrar las cabeceras que el VLOOKUP necesita.

function crearPestanasMaestras() {
  var ss = getSpreadsheet();
  if (!ss) {
    Logger.log("❌ No se pudo conectar.");
    return;
  }

  var estructura = {
    "05_MAESTRO_RECURSOS": ["Código", "Descripción", "Unidad", "P.U. Meta (S/)"],
    "06_MAESTRO_PARTIDAS_EV": ["#", "Código Partida", "Descripción", "Unidad", "Metrado", "P.U. Directo Meta (S/)"]
  };

  for (var tab in estructura) {
    if (ss.getSheetByName(tab)) {
      Logger.log("ℹ️ Pestaña '" + tab + "' ya existe.");
      continue;
    }
    var s = ss.insertSheet(tab);
    s.appendRow(estructura[tab]);
    Logger.log("✅ Pestaña '" + tab + "' creada con cabecera.");
  }
}