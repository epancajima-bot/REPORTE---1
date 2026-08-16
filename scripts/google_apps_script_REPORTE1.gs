// ==============================================================================
// GOOGLE APPS SCRIPT - CONECTOR DE BASE DE DATOS VIVA EN GOOGLE SHEETS
// Proyecto: Redes Sanitarias de Agua Potable y Alcantarillado
// Vinculado a: https://epancajima-bot.github.io/REPORTE---1/
// ==============================================================================

var TAB_NAME_LOGS = "04_LOG_FIELD_ENTRIES";

// URL raíz de la página publicada en GitHub Pages (ajustar si cambia el repo/sitio)
var GH_PAGES_URL = "https://epancajima-bot.github.io/REPORTE---1/";

var SPREADSHEET_ID_OR_URL = null;

function getSpreadsheet() {
  try {
    if (SPREADSHEET_ID_OR_URL) {
      if (SPREADSHEET_ID_OR_URL.indexOf("https://") === 0) {
        return SpreadsheetApp.openByUrl(SPREADSHEET_ID_OR_URL);
      } else {
        return SpreadsheetApp.openById(SPREADSHEET_ID_OR_URL);
      }
    }
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {
    console.error("Error al obtener hoja:", err);
  }
  return null;
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: "ERROR", message: "Payload JSON no recibido" });
    }

    var rawContent = JSON.parse(e.postData.contents);
    var records = Array.isArray(rawContent) ? rawContent : [rawContent];

    var ss = getSpreadsheet();
    if (!ss) {
      return responseJSON({ 
        status: "ERROR", 
        message: "No se pudo acceder al Google Sheet activo. Asegúrate de abrir Apps Script desde el menú Extensiones > Apps Script de tu hoja de cálculo actual." 
      });
    }

    var sheet = ss.getSheetByName(TAB_NAME_LOGS);

    if (!sheet) {
      sheet = ss.insertSheet(TAB_NAME_LOGS);
      sheet.appendRow([
        "ID Registro", "Fecha", "Rol Responsable", "Código WBS", 
        "Código Recurso/Partida", "Descripción / Detalle", "Cantidad Campo", 
        "Unidad", "P.U. (Busca en Maestro)", "Subtotal Monto (S/)", 
        "Categoría EVM", "Origen HTML"
      ]);
    }

    // Determinar el siguiente número secuencial para el ID LOG-YYYYMMDD-XXX
    var nextNum = 1;
    var todayStr = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    var startRow = sheet.getLastRow();
    
    if (startRow >= 2) {
      var ids = sheet.getRange(2, 1, startRow - 1, 1).getValues();
      for (var r = ids.length - 1; r >= 0; r--) {
        var currId = ids[r][0].toString();
        if (currId.indexOf("LOG-") === 0) {
          var parts = currId.split("-");
          if (parts.length === 3) {
            var lastNum = parseInt(parts[2], 10);
            if (!isNaN(lastNum)) {
              nextNum = lastNum + 1;
              break;
            }
          }
        }
      }
    }

    var insertedCount = 0;

    for (var i = 0; i < records.length; i++) {
      var data = records[i];
      
      // Calcular la fila exacta de forma correlativa para evitar que getLastRow() devuelva
      // un valor desactualizado dentro de bucles rápidos antes de que se limpie la caché de Sheets.
      var currentRow = startRow + i + 1;

      // Generación secuencial de ID Registro para evitar códigos UUID complejos
      var numStr = nextNum.toString();
      while (numStr.length < 3) {
        numStr = "0" + numStr;
      }
      var idVal = "LOG-" + todayStr + "-" + numStr;
      nextNum++;

      var fechaVal = data.fecha || new Date().toISOString().split("T")[0];
      var rolVal = data.rol || data.emisor_rol || "Sin Rol";
      var wbsVal = data.wbs || data.wbs_codigo || "WBS-100";
      
      // Forzar formato de texto para códigos numéricos como "01.01" para evitar que Sheets los convierta en números decimales (ej. 1.01) y rompa el VLOOKUP
      var codVal = data.codigoRecurso || data.codigo_recurso_partida || "MO_PEON";
      codVal = String(codVal);
      if (codVal.match(/^\d+(\.\d+)+$/) || !isNaN(codVal)) {
        codVal = "'" + codVal;
      }

      var detVal = data.detalle || data.descripcion || "";
      var cantVal = Number(data.cantidad) || 0.0;
      var undVal = data.unidad || "und";
      var catVal = data.tipo || data.categoria_evm || "AC_MO";
      var origVal = data.origen_html || "almacenero.html";

      sheet.appendRow([
        idVal, fechaVal, rolVal, wbsVal, codVal, detVal, cantVal, undVal,
        "", "", catVal, origVal
      ]);

      // Centrar el contenido de las columnas A, D, E y H en la fila insertada
      sheet.getRange(currentRow, 1).setHorizontalAlignment("center"); // Col A (ID Registro)
      sheet.getRange(currentRow, 4).setHorizontalAlignment("center"); // Col D (Código WBS)
      sheet.getRange(currentRow, 5).setHorizontalAlignment("center"); // Col E (Código Recurso/Partida)
      sheet.getRange(currentRow, 8).setHorizontalAlignment("center"); // Col H (Unidad)

      // Fórmulas en notación A1 limpia y alineada con la estructura del Excel
      // Busca en '05_MAESTRO_RECURSOS' (Col D: P.U. Meta Oficial) o '06_MAESTRO_PARTIDAS_EV' (Col F: P.U. Directo Meta)
      var rangePU = sheet.getRange(currentRow, 9);
      rangePU.setFormula("=IFERROR(VLOOKUP(E" + currentRow + ", '05_MAESTRO_RECURSOS'!A:D, 4, FALSE), IFERROR(VLOOKUP(E" + currentRow + ", '06_MAESTRO_PARTIDAS_EV'!B:F, 5, FALSE), 0))");
      rangePU.setNumberFormat("S/ #,##0.00");

      var rangeSubtotal = sheet.getRange(currentRow, 10);
      rangeSubtotal.setFormula("=ROUND(G" + currentRow + " * I" + currentRow + ", 2)");
      rangeSubtotal.setNumberFormat("S/ #,##0.00");

      insertedCount++;
    }

    return responseJSON({
      status: "SUCCESS",
      message: "Se insertaron " + insertedCount + " registro(s) correctamente en la pestaña " + TAB_NAME_LOGS + " de Google Sheets.",
      count: insertedCount
    });

  } catch (error) {
    return responseJSON({
      status: "ERROR",
      message: "Error al procesar registro en Google Sheets: " + error.toString()
    });
  }
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) {
      return responseJSON({ status: "ERROR", message: "No se pudo acceder a la hoja de cálculo." });
    }

    var sheetLogs = ss.getSheetByName(TAB_NAME_LOGS);
    var logsData = [];
    
    if (sheetLogs) {
      var lastRowLogs = sheetLogs.getLastRow();
      if (lastRowLogs >= 2) {
        var rangeLogs = sheetLogs.getRange(2, 1, lastRowLogs - 1, 12); // Leer las 12 columnas (A a L)
        var valuesLogs = rangeLogs.getValues();
        
        for (var i = 0; i < valuesLogs.length; i++) {
          var row = valuesLogs[i];
          if (!row[0] && !row[4]) continue;

          var fechaVal = row[1];
          if (fechaVal instanceof Date) {
            fechaVal = Utilities.formatDate(fechaVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
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

    // LEER CONSOLIDADO DE EVM POR WBS (PESTAÑA 03)
    var consolidadoData = [];
    var sheetConsolidado = ss.getSheetByName("03_CONSOLIDADO_DIARIO_EVM_WBS");
    if (sheetConsolidado) {
      var lastRowCons = sheetConsolidado.getLastRow();
      if (lastRowCons >= 2) {
        var rangeCons = sheetConsolidado.getRange(2, 1, lastRowCons - 1, 12); // Leer las 12 columnas (A a L)
        var valuesCons = rangeCons.getValues();
        
        for (var j = 0; j < valuesCons.length; j++) {
          var rowC = valuesCons[j];
          if (!rowC[1] || !rowC[2]) continue; // Necesita fecha y WBS

          var fechaCVal = rowC[1];
          if (fechaCVal instanceof Date) {
            fechaCVal = Utilities.formatDate(fechaCVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
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
      version: "1.1.0",
      proyecto: "Redes Sanitarias de Agua Potable y Alcantarillado",
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

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Función de prueba directa para autorizar permisos de Google Sheets
function probarConexion() {
  var ss = getSpreadsheet();
  if (ss) {
    Logger.log("✅ Conexión exitosa al Google Sheet: " + ss.getName());
    var sheet = ss.getSheetByName(TAB_NAME_LOGS);
    if (sheet) {
      Logger.log("✅ Pestaña encontrada: " + TAB_NAME_LOGS + " con " + sheet.getLastRow() + " filas.");
      try {
        // Intentar escribir un valor de prueba en una celda temporal y luego borrarlo
        var tempRange = sheet.getRange("Z1");
        tempRange.setValue("TEST_WRITE");
        tempRange.clearContent();
        Logger.log("✅ Permiso de ESCRITURA confirmado con éxito.");
      } catch (writeErr) {
        Logger.log("❌ ERROR DE ESCRITURA: Tu cuenta no tiene permisos de Editor en este documento. Detalle: " + writeErr.toString());
      }
    } else {
      Logger.log("⚠️ La pestaña " + TAB_NAME_LOGS + " no existe aún (se creará automáticamente).");
    }
  } else {
    Logger.log("❌ No se pudo conectar a la hoja de cálculo.");
  }
}

// Función sin try-catch para forzar la ventana emergente de permisos de Google.
// Ajusta el ID de la hoja de cálculo si tu base viva está en otro documento.
function forzarAutorizacion() {
  var ss = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/1nlN-U7iJFBlGNS-q0xBxSzJWSDI2uMr_dCZ2eU6W3hE/edit");
  Logger.log("✅ Documento abierto con éxito: " + ss.getName());
}

// Macro para importar la base de datos sintética directamente desde tu GitHub Pages
function importarBaseSinteticaDesdeGithub() {
  var url = GH_PAGES_URL + "data/base_datos_reportabilidad.json";
  Logger.log("📥 Descargando base de datos sintética desde GitHub Pages: " + url);
  
  try {
    var response = UrlFetchApp.fetch(url);
    var json = JSON.parse(response.getContentText());
    var logs = json.registros_diarios;
    
    if (!logs || logs.length === 0) {
      Logger.log("❌ No se encontraron registros en el JSON.");
      return;
    }
    
    Logger.log("✅ Se descargaron " + logs.length + " registros.");
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("04_LOG_FIELD_ENTRIES");
    
    if (!sheet) {
      Logger.log("❌ Pestaña '04_LOG_FIELD_ENTRIES' no encontrada.");
      return;
    }
    
    // 1. Limpiar registros antiguos (fila 2 en adelante)
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.deleteRows(2, lastRow - 1);
    }
    Logger.log("🧹 Pestaña 04_LOG_FIELD_ENTRIES limpiada.");
    
    // 2. Preparar el array de datos
    var rowsToWrite = [];
    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];
      
      // Parsear fecha yyyy-mm-dd a objeto Date de Google Sheets
      var dateParts = log.fecha.split("-");
      var dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      
      // Generar fórmulas
      var rowNum = i + 2; // Inicia en fila 2
      var formulaPU = "=IFERROR(VLOOKUP(E" + rowNum + "; '05_MAESTRO_RECURSOS'!A:D; 4; FALSE); IFERROR(VLOOKUP(E" + rowNum + "; '06_MAESTRO_PARTIDAS_EV'!B:F; 5; FALSE); 0))";
      var formulaCosto = "=ROUND(G" + rowNum + " * I" + rowNum + "; 2)";
      
      rowsToWrite.push([
        log.id_registro || log.id,
        dateObj, // Date object para que MAX funcione en Google Sheets
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
    
    // 3. Escribir todas las filas en un solo bloque (muy rápido)
    var range = sheet.getRange(2, 1, rowsToWrite.length, 12);
    range.setValues(rowsToWrite);
    
    // Formatear columna B como fecha
    sheet.getRange(2, 2, rowsToWrite.length, 1).setNumberFormat("yyyy-mm-dd");
    
    // Centrar columnas A, D, E, H
    sheet.getRange(2, 1, rowsToWrite.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 4, rowsToWrite.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 5, rowsToWrite.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 8, rowsToWrite.length, 1).setHorizontalAlignment("center");
    
    Logger.log("🚀 ¡Importación completada! Se insertaron " + rowsToWrite.length + " filas con éxito.");
    
  } catch (error) {
    Logger.log("❌ Error en la importación: " + error.toString());
  }
}