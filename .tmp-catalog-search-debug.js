const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: '192.168.1.250', port: 3306, user: 'web', password: 'webfmolvera17', database: 'datosb' });
  const sql = `
    SELECT
      inv.ARTICULOID AS id,
      TRIM(inv.CLVPROV) AS codigo,
      TRIM(inv.CLAVE) AS clave,
      TRIM(inv.DESCRIPCIO) AS descripcion,
      TRIM(inv.XXMARCA) AS marca,
      TRIM(inv.XMCA_IMAG) AS imagenMarca,
      TRIM(inv.XIMAGEN2) AS imagen,
      CASE
        WHEN inv.CLAVEPRODSERV IS NULL THEN NULL
        ELSE LPAD(TRIM(CAST(inv.CLAVEPRODSERV AS CHAR)), 8, '0')
      END AS claveProdServ,
      'H87' AS claveUnidad,
      TRIM(uni.UNIDAD) AS unidad,
      alm.ALMACEN AS almacen,
      IFNULL(inv.LOTE, 0) AS lote,
      IFNULL(inv.INVDESCUENTO, 0) AS descuento,
      IFNULL(pre.PIMPUESTO, 0) AS iva,
      IFNULL(ROUND((pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))), 2), 0) AS precioRegular,
      IFNULL(
        ROUND(
          (pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))) * (1 - (IFNULL(inv.INVDESCUENTO, 0) / 100)),
          2
        ),
        0
      ) AS precioDescuento
    FROM datosb.INV inv
    LEFT JOIN datosb.preciofinal pre
      ON inv.ARTICULOID = pre.ARTICULOID
      AND inv.UNIVENID = pre.UNIDADID
    LEFT JOIN datosb.UNIDADES uni
      ON inv.ARTICULOID = uni.ARTICULOID
      AND inv.UNIBASID = uni.UNIDADID
    LEFT JOIN datosb.ALM alm
      ON inv.ARTICULOID = alm.ARTICULOID
      AND alm.ALMACEN = inv.ALMDEF
    WHERE (
      LOWER(TRIM(COALESCE(inv.CLAVE, ''))) LIKE ?
      OR LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ?
      OR LOWER(TRIM(COALESCE(inv.CLVPROV, ''))) LIKE ?
    )
      AND pre.NPRECIO = 1
      AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
      AND inv.CATALOGO IN ('0', '1', '2')
    ORDER BY
      CASE
        WHEN LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ? THEN 1
        WHEN LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ? THEN 2
        WHEN LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ? THEN 3
        ELSE 6
      END ASC,
      inv.DESCRIPCIO ASC
    LIMIT ?`;
  try {
    const [rows] = await conn.execute(sql, ['%mar%','%mar%','%mar%','mar %','% mar %','%mar%',5]);
    console.log(JSON.stringify({ ok: true, count: rows.length, sample: rows[0] ?? null }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, message: error.message, code: error.code, errno: error.errno, sqlMessage: error.sqlMessage, sqlState: error.sqlState }, null, 2));
  } finally {
    await conn.end();
  }
})();
