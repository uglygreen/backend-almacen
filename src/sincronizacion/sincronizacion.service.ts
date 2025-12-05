import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ControlSincronizacion, DetallePedido, Pedido, Producto, ProductoCodigo, StatusGlobal, Zona } from 'src/entities';
import { EventsGateway } from 'src/events/events.gateway';
import { DataSource, In, Not, Repository } from 'typeorm';


// Interfaz auxiliar para el tipado interno del array acumulador
interface DetalleTemp {
  producto: Producto;
  cantidadSolicitada: number;
  zonaSurtido: Zona;
}


@Injectable()
export class SincronizacionService {
  private readonly logger = new Logger(SincronizacionService.name);

  private isSyncing = false;

  constructor(
    // Conexión a tu BD principal (Escritura)
    @InjectDataSource('default') private dataSourceSistemas: DataSource,
    @InjectRepository(ControlSincronizacion) private controlRepo: Repository<ControlSincronizacion>,
    
    // Conexión a BD Legacy (Lectura - datosb)
    @InjectDataSource('legacy_db') private dataSourceLegacy: DataSource,

    private eventsGateway: EventsGateway
  ) {}

  // Se ejecuta cada 60 segundos
  @Cron(CronExpression.EVERY_MINUTE)
  async sincronizarPedidos() {

     if (this.isSyncing) {
      this.logger.debug('Sincronización anterior en progreso. Saltando ejecución.');
      return;
    }

    this.isSyncing = true; // Bloqueamos
    try {
        this.logger.log('Iniciando sincronización de pedidos...');
        
        // 1. Obtener último ID procesado
        let control = await this.controlRepo.findOne({ where: { id: 1 } });
        if (!control) {
        control = this.controlRepo.create({ id: 1, ultimoDocId: 0, fechaEjecucion: new Date() });
        await this.controlRepo.save(control);
        }

        const ultimoId = control.ultimoDocId;

        // 2. Consultar BD Legacy (La consulta SQL que diseñamos)
        // NOTA: Usamos parámetros (?) para evitar inyección SQL, aunque sea interna
        const rawData = await this.dataSourceLegacy.query(`
        SELECT 
            D.DOCID, D.NUMERO, D.SERIE, D.FECHA, C.NOMBRE AS CLIENTE,
            I.ARTICULOID,I.CLVPROV, I.CLAVE, I.DESCRIPCIO, I.CODBAR, I.XIMAGEN2, DS.DESCANTIDAD, A.UBICACION, CLA.CLATEXTO
        FROM DOC D
        JOIN DES DS ON D.DOCID = DS.DESDOCID
        JOIN INV I ON DS.DESARTID = I.ARTICULOID
        LEFT JOIN ALM A ON I.ARTICULOID = A.ARTICULOID AND A.ALMACEN = 1
        JOIN CLI C ON D.CLIENTEID = C.CLIENTEID
        LEFT OUTER JOIN CARCLI CAR ON D.CLIENTEID = CAR.CARID
        LEFT OUTER JOIN CLA ON CAR.CARACTERISTICA = CLA.CLAID
        WHERE D.TIPO = 'C' AND D.ESTADO= 'A' AND CLA.CLATEXTO IN ('01', '02') AND D.DOCID > ?
        ORDER BY D.DOCID ASC
        LIMIT 500
        `, [ultimoId]);

        if (rawData.length > 0) {
            await this.procesarNuevosPedidos(rawData, ultimoId);
        } else {
            this.logger.log('No hay pedidos nuevos por importar.');
        }

        // --- PASO 2: VERIFICAR SI PEDIDOS ACTIVOS YA FUERON FACTURADOS (ESTADO F) ---
        await this.verificarPedidosFacturados();

        } catch (err) {
        this.logger.error('Error general en sincronización', err);
        } finally {
        // IMPORTANTE: Liberar el semáforo SIEMPRE al final
        this.isSyncing = false;
        }
    }


    // Lógica separada para procesar la importación
  private async procesarNuevosPedidos(rawData: any[], ultimoId: number) {
    const pedidosMap = new Map<number, any[]>();

     // Recolectamos IDs únicos de artículos para consultar sus códigos extra de una sola vez
    const articuloIds = new Set<number>();

    rawData.forEach((row: any) => {
      let items = pedidosMap.get(row.DOCID);
      if (!items) {
        items = [];
        pedidosMap.set(row.DOCID, items);
      }
      items.push(row);

        if (row.ARTICULOID) articuloIds.add(row.ARTICULOID);
    });

     // --- NUEVO: CONSULTA DE CÓDIGOS DE EMPAQUETADO (Tabla COD) ---
    const codigosExtraMap = new Map<number, any[]>();
    if (articuloIds.size > 0) {
      const idsArray = Array.from(articuloIds);
      // Nota: Si son muchísimos IDs, habría que paginar esto, pero con LIMIT 100 pedidos es seguro.
      const codigosData = await this.dataSourceLegacy.query(`
        SELECT ARTICULOID, CODIGO, PREFIJO 
        FROM COD 
        WHERE ARTICULOID IN (${idsArray.join(',')})
      `);

      codigosData.forEach((cod: any) => {
        // Obtenemos la lista actual o undefined
        let lista = codigosExtraMap.get(cod.ARTICULOID);
        
        // Si no existe, creamos una nueva y la guardamos en el mapa
        if (!lista) {
          lista = [];
          codigosExtraMap.set(cod.ARTICULOID, lista);
        }
        
        
        lista.push(cod);
      });
    }

    // --- VALIDACIÓN ANTI-DUPLICADOS ---
    // 1. Obtenemos todos los DOCID del lote actual.
    const docIdsDelLote = Array.from(pedidosMap.keys());
    
    // 2. Consultamos cuáles de esos IDs ya existen en nuestra BD.
    const pedidosYaExistentes = await this.dataSourceSistemas.getRepository(Pedido).find({
      where: { idExternoDoc: In(docIdsDelLote) },
      select: ['idExternoDoc']
    });
    const idsYaExistentes = new Set(pedidosYaExistentes.map(p => p.idExternoDoc));

    const queryRunner = this.dataSourceSistemas.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Control para no procesar códigos del mismo producto múltiples veces en el mismo lote
    const productosProcesadosEnLote = new Set<number>();

    try {
      let maxProcesado = ultimoId;

      for (const [docId, items] of pedidosMap) {
        // 3. Si el DOCID actual ya existe, lo saltamos.
        if (idsYaExistentes.has(docId)) {
          this.logger.debug(`Saltando DOCID ${docId} porque ya existe (id_externo_doc).`);
          // Nos aseguramos de que el contador de último ID avance de todas formas.
          if (docId > maxProcesado) maxProcesado = docId;
          continue;
        }

        let requiereCuartoChico = false;
        const detallesAGuardar: DetalleTemp[] = [];

        for (const item of items) {
          let zona: Zona = Zona.AG;
          
          if (['OFICINA', 'SUPERIOR', 'MAQUINARIA', 'POLVOS', 'MANGUERA'].includes(item.UBICACION)) {
             zona = Zona.AG;
          } else if (item.UBICACION && item.UBICACION.startsWith('P')) {
             const charDespuesP = item.UBICACION.charAt(1);
             if (/[A-Z]/.test(charDespuesP)) {
                zona = Zona.CC;
             } else {
                zona = Zona.AG;
             }
          }

          if (zona === Zona.CC) requiereCuartoChico = true;

          const codigoParaBuscar = item.CLVPROV; 

          let producto = await queryRunner.manager.findOne(Producto, { where: { codigo: codigoParaBuscar } });
          
          if (!producto) {
            producto = queryRunner.manager.create(Producto, {
              codigo: codigoParaBuscar,
              clave: item.CLAVE,
              codbar: item.CODBAR,
              nombre: item.DESCRIPCIO,
              ubicacion: item.UBICACION,
              zonaAsignada: zona,
              idExterno: item.ARTICULOID,
              img: item.XIMAGEN2
            });
            await queryRunner.manager.save(producto);
          } else {
             if (producto.ubicacion !== item.UBICACION || producto.img !== item.XIMAGEN2) {
               producto.ubicacion = item.UBICACION;
               producto.img = item.XIMAGEN2;
               await queryRunner.manager.save(producto);
             }
          }

           // --- PROCESAR CÓDIGOS DE EMPAQUETADO ---
          if (!productosProcesadosEnLote.has(producto.id)) {
            productosProcesadosEnLote.add(producto.id);
            
            const codigosDelProducto = codigosExtraMap.get(item.ARTICULOID);
            
            if (codigosDelProducto && codigosDelProducto.length > 0) {
              await queryRunner.manager.delete(ProductoCodigo, { producto: { id: producto.id } });

              for (const cod of codigosDelProducto) {
                const prefijoLimpio = parseInt(String(cod.PREFIJO).replace('*', ''), 10) || 1;
                
                const nuevoCodigo = queryRunner.manager.create(ProductoCodigo, {
                  codigo: cod.CODIGO,
                  prefijo: prefijoLimpio,
                  producto: producto
                });
                await queryRunner.manager.save(nuevoCodigo);
              }
            }
          }


          detallesAGuardar.push({
            producto,
            cantidadSolicitada: item.DESCANTIDAD,
            zonaSurtido: zona
          });
        }

       

        const nuevoPedido = queryRunner.manager.create(Pedido, {
          idExternoDoc: docId,
          folioExterno: items[0].NUMERO,
          serie: items[0].SERIE,
          clienteNombre: items[0].CLIENTE,
          fechaCreacion: items[0].FECHA || new Date(),
          requiereCuartoChico: requiereCuartoChico,
          clatexto: items[0].CLATEXTO == '01' ? 'TX' : 'QRO',
          statusGlobal: requiereCuartoChico ? StatusGlobal.ESPERA_CC : StatusGlobal.PENDIENTE_AG
        });

        const pedidoGuardado = await queryRunner.manager.save(nuevoPedido);
        
        for (const det of detallesAGuardar) {
          const linea = queryRunner.manager.create(DetallePedido, {
            pedido: pedidoGuardado,
            producto: det.producto,
            cantidadSolicitada: det.cantidadSolicitada,
            zonaSurtido: det.zonaSurtido
          });
          await queryRunner.manager.save(linea);
        }

        // Emitir evento Nuevo Pedido
        this.eventsGateway.emitirNuevoPedido(nuevoPedido);

        if (docId > maxProcesado) maxProcesado = docId;
      }

      // Actualizamos control
      const control = await queryRunner.manager.findOne(ControlSincronizacion, { where: { id: 1 } });
      if (control) {
        control.ultimoDocId = maxProcesado;
        control.fechaEjecucion = new Date();
        await queryRunner.manager.save(control);
      }

      await queryRunner.commitTransaction();
      
      this.logger.log(`Importación completada. Último DOCID: ${maxProcesado}`);

    } catch (err) {
      this.logger.error('Error en transacción de importación', err);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  // --- NUEVA FUNCIONALIDAD: LIMPIEZA DE PEDIDOS FACTURADOS ---
  private async verificarPedidosFacturados() {
    // 1. Buscamos pedidos en 'sistemas' que estén activos (ni completados ni empaquetados)
    const pedidoRepo = this.dataSourceSistemas.getRepository(Pedido);
    
    const pedidosActivos = await pedidoRepo.find({
      where: {
        statusGlobal: Not(In([StatusGlobal.COMPLETADO, StatusGlobal.EMPAQUETADO]))
      },
      select: ['id', 'idExternoDoc'] // Solo necesitamos los IDs
    });

    if (pedidosActivos.length === 0) return;

    // Filtramos solo los que tienen ID externo válido
    const idsExternos = pedidosActivos
      .map(p => p.idExternoDoc)
      .filter(id => id !== null && id !== undefined);

    if (idsExternos.length === 0) return;

    // Para evitar errores por listas muy largas, procesamos en lotes de 100
    const chunkSize = 100;
    for (let i = 0; i < idsExternos.length; i += chunkSize) {
      const chunk = idsExternos.slice(i, i + chunkSize);
      
      if (chunk.length === 0) continue;

      // 2. Preguntamos a Legacy cuáles de estos IDs ya tienen ESTADO = 'F'
      const idsString = chunk.join(',');
      const facturados = await this.dataSourceLegacy.query(`
        SELECT DOCID FROM DOC 
        WHERE DOCID IN (${idsString}) AND ESTADO = 'F'
      `);

      if (facturados.length > 0) {
        const idsFacturados = facturados.map((f: any) => f.DOCID);
        
        // 3. Actualizamos en Sistemas a estado 'COMPLETADO' (o EMPAQUETADO)
        // Esto los saca de los paneles de surtido
        await pedidoRepo.update(
          { idExternoDoc: In(idsFacturados) },
          { 
            statusGlobal: StatusGlobal.COMPLETADO, 
            // Opcional: Podrías agregar una nota o fecha de cierre automático
            fechaFinAg: new Date() 
          }
        );
        
        this.logger.log(`Se cerraron ${idsFacturados.length} pedidos remotamente (Facturados en Legacy).`);

        // 4. Notificar por WebSocket para que los paneles se actualicen en tiempo real.
        // Buscamos los pedidos que acabamos de cerrar para obtener sus IDs internos.
        const pedidosCerrados = pedidosActivos.filter(p => idsFacturados.includes(p.idExternoDoc));

        // Emitimos un evento por cada uno.
        for (const pedido of pedidosCerrados) {
          this.eventsGateway.emitirCambioEstado({ idPedido: pedido.id, nuevoEstado: StatusGlobal.COMPLETADO });
        }
      }
    }
  }
    
}