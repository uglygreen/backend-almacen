import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';


@Injectable()
export class MetricasService {
  constructor(@InjectDataSource('default') private dataSource: DataSource) {}

//   // 1. Ranking de Almacenistas (Mejor surtidor)
//   async getRankingAlmacenistas(zona: 'CC' | 'AG', periodo: 'dia' | 'semana' | 'mes') {
//     // Definir filtro de fecha
//     let fechaFiltro = 'CURDATE()'; // Por defecto hoy
//     if (periodo === 'semana') fechaFiltro = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
//     if (periodo === 'mes') fechaFiltro = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';

//     const campoUsuario = zona === 'CC' ? 'surtidor_cc_id' : 'surtidor_ag_id';
//     const campoFecha = zona === 'CC' ? 'fecha_fin_cc' : 'fecha_fin_ag';

//     // Consulta compleja: Cuenta pedidos terminados y total de items surtidos
//     return this.dataSource.query(`
//       SELECT 
//         u.nombre,
//         u.img as avatar,
//         COUNT(DISTINCT p.id) as pedidos_completados,
//         SUM(dp.cantidad_surtida) as productos_totales,
//         AVG(tiempo_minutos) AS tiempo_promedio_minutos
//       FROM (
//         SELECT
//             id, ${campoUsuario},
//             TIMESTAMPDIFF(SECOND, fecha_inicio_${zona.toLowerCase()}, fecha_fin_${zona.toLowerCase()}) / 60 AS tiempo_minutos
//         FROM pedidos
//         WHERE ${campoFecha} >= ${fechaFiltro}
//       ) AS p
//       JOIN almacen_user u ON p.${campoUsuario} = u.id_almacenista
//       JOIN detalle_pedidos dp ON p.id = dp.pedido_id
//       WHERE dp.zona_surtido = '${zona === 'CC' ? 'CUARTO_CHICO' : 'ALMACEN_GRAL'}'
//       GROUP BY u.id_almacenista
//       ORDER BY productos_totales DESC
//     `);
//   }

 // Ranking: Ahora con desglose horario
  async getRankingAlmacenistas(zona: 'CC' | 'AG', periodo: 'dia' | 'semana' | 'mes') {
    let fechaFiltro = 'CURDATE()'; 
    if (periodo === 'semana') fechaFiltro = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
    if (periodo === 'mes') fechaFiltro = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';

    const campoUsuario = zona === 'CC' ? 'surtidor_cc_id' : 'surtidor_ag_id';
    const campoFechaInicio = zona === 'CC' ? 'fecha_inicio_cc' : 'fecha_inicio_ag';
    const zonaEnum = zona === 'CC' ? 'CUARTO_CHICO' : 'ALMACEN_GRAL';

    // Generamos las columnas dinámicas para las horas de 9 a 19
    const horas = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const selectHoras = horas.map(h => `
      COUNT(DISTINCT CASE WHEN HOUR(p.${campoFechaInicio}) = ${h} THEN p.id END) as ped_${h},
      COUNT(CASE WHEN HOUR(p.${campoFechaInicio}) = ${h} THEN dp.id END) as prod_${h}
    `).join(',');

    // Lógica SQL para calcular inactividad (basado en la última vez que tomó un pedido)
    // Se compara la hora actual contra la máxima fecha de inicio registrada para ese usuario
    const query = `
      SELECT 
        u.id_almacenista,
        u.nombre,
        u.img,
        COUNT(DISTINCT p.id) as pedidos_completados,
        
        -- Contamos partidas (filas de detalle)
        COUNT(dp.id) as productos_totales, 
        
        -- Inactividad Actual (Tiempo desde que inició el último pedido hasta ahora)
        TIMESTAMPDIFF(MINUTE, MAX(p.${campoFechaInicio}), NOW()) as tiempo_muerto_min,
        
        ${selectHoras}
      
      FROM pedidos p
      JOIN almacen_user u ON p.${campoUsuario} = u.id_almacenista
      JOIN detalle_pedidos dp ON p.id = dp.pedido_id
      WHERE p.${campoFechaInicio} >= ${fechaFiltro}
        AND dp.zona_surtido = '${zonaEnum}'
      GROUP BY u.id_almacenista, u.nombre, u.img
      ORDER BY productos_totales DESC
    `;

    const rawResults = await this.dataSource.query(query);

    // Transformación para el Frontend (anidar horas)
    return rawResults.map(row => {
      const horasObj = {};
      horas.forEach(h => {
        horasObj[h] = {
          pedidos: Number(row[`ped_${h}`] || 0),
          productos: Number(row[`prod_${h}`] || 0)
        };
        delete row[`ped_${h}`];
        delete row[`prod_${h}`];
      });

      return {
        ...row,
        horas: horasObj,
        tiempo_muerto_min: Number(row.tiempo_muerto_min || 0),
        tiempo_sin_surtir_min: Number(row.tiempo_sin_surtir_min || 0)
      };
    });
  }

  // 2. Monitoreo en Vivo (Tiempos muertos)
  async getTiemposMuertos() {
    // Busca usuarios activos y calcula cuánto tiempo ha pasado desde su última acción
    return this.dataSource.query(`
     SELECT 
    u.nombre,
    u.area AS rol,
    u.id_almacenista,
    MAX(COALESCE(p.fecha_fin_cc, p.fecha_fin_ag)) AS ultima_accion,
    TIMESTAMPDIFF(
        MINUTE,
        MAX(COALESCE(p.fecha_fin_cc, p.fecha_fin_ag)),
        NOW()
    ) AS minutos_inactivo
FROM almacen_user u
LEFT JOIN pedidos p 
    ON (
        (p.surtidor_cc_id = u.id_almacenista OR p.surtidor_ag_id = u.id_almacenista)
        AND (p.fecha_fin_cc IS NOT NULL OR p.fecha_fin_ag IS NOT NULL)
    )
WHERE u.activo = 1
  AND u.area IN ('cc', 'almacen', 'chofer', 'asesor', 'apoyo')
GROUP BY u.id_almacenista
HAVING minutos_inactivo > 0
ORDER BY minutos_inactivo DESC;
    `);
  }

  // 3. Velocidad de Surtido (Productos por Hora)
  async getVelocidadPromedio() {
    return this.dataSource.query(`
      SELECT 
        DATE(p.fecha_creacion) as fecha,
        COUNT(dp.id) as total_items,
        SUM(TIMESTAMPDIFF(MINUTE, p.fecha_inicio_ag, p.fecha_fin_ag)) / 60 as horas_trabajadas_ag
      FROM pedidos p
      JOIN detalle_pedidos dp ON p.id = dp.pedido_id
      WHERE p.status_global = 'SURTIDO_COMPLETO'
      GROUP BY DATE(p.fecha_creacion)
      ORDER BY fecha DESC
      LIMIT 7
    `);
  }

  // 4. Detalle de pedidos y partidas por hora
  async getDetallePedidosPorHora(id: number, zona: 'CC' | 'AG', horaInicio: string, horaFinal: string) {
    const campoUsuario = zona === 'CC' ? 'surtidor_cc_id' : 'surtidor_ag_id';
    const campoFechaInicio = zona === 'CC' ? 'fecha_inicio_cc' : 'fecha_inicio_ag';
    const lugarEstatico = zona === 'CC' ? 'cc' : 'al';
    const zonaEnum = zona === 'CC' ? 'CUARTO_CHICO' : 'ALMACEN_GRAL';

    return this.dataSource.query(`
      SELECT 
        DATE(p.${campoFechaInicio}) as fecha,
        TIME(p.${campoFechaInicio}) as hora,
        CAST(u.id_almacenista AS CHAR) as id_almacenista,
        '${lugarEstatico}' as lugar,
        u.nombre,
        CAST(COUNT(dp.id) AS CHAR) as partidas,
        p.folio_externo as pedido
      FROM pedidos p
      JOIN almacen_user u ON p.${campoUsuario} = u.id_almacenista
      JOIN detalle_pedidos dp ON p.id = dp.pedido_id
      WHERE p.${campoUsuario} = ?
        AND DATE(p.${campoFechaInicio}) = CURDATE()
        AND TIME(p.${campoFechaInicio}) >= ?
        AND TIME(p.${campoFechaInicio}) <= ?
        AND dp.zona_surtido = ?
      GROUP BY p.id, u.id_almacenista, u.nombre, p.folio_externo, p.${campoFechaInicio}
      ORDER BY p.${campoFechaInicio} ASC
    `, [id, horaInicio, horaFinal, zonaEnum]);
  }
}