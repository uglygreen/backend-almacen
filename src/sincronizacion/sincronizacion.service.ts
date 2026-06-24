import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ControlSincronizacion, DetallePedido, Pedido, Producto, ProductoCodigo, StatusEntrega, StatusGlobal, Zona } from 'src/entities';
import { EventsGateway } from 'src/events/events.gateway';
import { DataSource, In, Not, Repository } from 'typeorm';
import { ClientesMobileOrderWorkflowService } from '../modules/clientes-mobile-orders/clientes-mobile-order-workflow.service';
import { ClienteMobileOrderLegacyDocument } from '../modules/clientes-mobile-orders/entities/cliente-mobile-order-legacy-document.entity';
import { ClienteMobileOrder, ClienteMobileOrderStatus } from '../modules/clientes-mobile-orders/entities/cliente-mobile-order.entity';
import { extractMobileReference, normalizeMobileReference } from '../modules/clientes-mobile-orders/utils/mobile-order-reference.util';


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

  private async logPedidoFechaTrace(contexto: string, pedidoId: number) {
    const pedido = await this.dataSourceSistemas.getRepository(Pedido).findOne({
      where: { id: pedidoId },
      select: ['id', 'statusGlobal', 'fechaInicioCc', 'fechaFinCc', 'fechaInicioAg', 'fechaFinAg'],
    });

    this.logger.warn(JSON.stringify({
      contexto,
      pedidoId,
      procesoAhora: new Date().toString(),
      procesoIso: new Date().toISOString(),
      pedido,
    }));
  }

  constructor(
    // Conexión a tu BD principal (Escritura)
    @InjectDataSource('default') private dataSourceSistemas: DataSource,
    @InjectRepository(ControlSincronizacion) private controlRepo: Repository<ControlSincronizacion>,
    
    // Conexión a BD Legacy (Lectura - datosb)
    @InjectDataSource('legacy_db') private dataSourceLegacy: DataSource,

    private eventsGateway: EventsGateway,
    private readonly mobileOrderWorkflowService: ClientesMobileOrderWorkflowService,
  ) {}

  // Se ejecuta cada 60 segundos
  @Cron(CronExpression.EVERY_10_SECONDS)
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

        const ultimoId = control.ultimoDocId - 500;

        // 2. Consultar BD Legacy para obtener solo los IDs de los nuevos pedidos.
        const nuevosPedidosRaw = await this.dataSourceLegacy.query(`
        SELECT DISTINCT D.DOCID
        FROM DOC D
        JOIN CLI C ON D.CLIENTEID = C.CLIENTEID
        LEFT OUTER JOIN CARCLI CAR ON D.CLIENTEID = CAR.CARID
        LEFT OUTER JOIN CLA ON CAR.CARACTERISTICA = CLA.CLAID
        WHERE D.TIPO IN ('C', 'W') AND D.ESTADO= 'A' AND D.FECHA = CURDATE() AND (CLA.CLATEXTO IN ('01', '02') OR CLA.CLATEXTO IS NULL) AND D.DOCID > ?
        ORDER BY D.DOCID ASC
        LIMIT 200
        `, [ultimoId]);

        if (nuevosPedidosRaw.length > 0) {
            const docIds = nuevosPedidosRaw.map((p: { DOCID: number }) => p.DOCID);
            await this.procesarPedidosPorIds(docIds, ultimoId);
        } else {
            this.logger.log('No hay pedidos nuevos por importar.');
        }

        // --- PASO 2: VERIFICAR SI PEDIDOS ACTIVOS YA FUERON FACTURADOS (ESTADO F) ---
        await this.verificarPedidosFacturados();

        // --- PASO 3: VERIFICAR SI PEDIDOS ACTIVOS FUERON CANCELADOS (ESTADO C) ---
        await this.verificarPedidosCancelados();

        } catch (err) {
        this.logger.error('Error general en sincronización', err);
        } finally {
        // IMPORTANTE: Liberar el semáforo SIEMPRE al final
        this.isSyncing = false;
        }
    }


  private async procesarPedidosPorIds(docIds: number[], ultimoId: number) {
    this.logger.log(`Se encontraron ${docIds.length} pedidos para procesar.`);

    // 1. Recolectamos IDs únicos de artículos de TODOS los pedidos nuevos para optimizar consultas.
    const articuloIds = new Set<number>();
    if (docIds.length > 0) {
      const itemsDePedidos = await this.dataSourceLegacy.query(`
        SELECT DS.DESARTID as ARTICULOID FROM DES DS WHERE DS.DESDOCID IN (${docIds.join(',')})
      `);
      itemsDePedidos.forEach((item: { ARTICULOID: number }) => {
        if (item.ARTICULOID) articuloIds.add(item.ARTICULOID);
      });
    }

     // --- NUEVO: CONSULTA DE CÓDIGOS DE EMPAQUETADO (Tabla COD) ---
    const codigosExtraMap = new Map<number, any[]>();
    if (articuloIds.size > 0) {
      const idsArray = Array.from(articuloIds);
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
    // 2. Consultamos cuáles de esos IDs ya existen en nuestra BD.
    const pedidosYaExistentes = await this.dataSourceSistemas.getRepository(Pedido).find({
      where: { idExternoDoc: In(docIds) },
      select: ['idExternoDoc']
    });
    const idsYaExistentes = new Set(pedidosYaExistentes.map(p => p.idExternoDoc));

    // Control para no procesar códigos del mismo producto múltiples veces en el mismo lote
    const productosProcesadosEnLote = new Set<number>();
    let maxProcesado = ultimoId;

    for (const docId of docIds) {
        // Si el DOCID actual ya existe, lo saltamos.
        if (idsYaExistentes.has(docId)) {
          this.logger.debug(`Saltando DOCID ${docId} porque ya existe (id_externo_doc).`);
          if (docId > maxProcesado) maxProcesado = docId;
          continue;
        }

        const queryRunner = this.dataSourceSistemas.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
        // Obtenemos los datos de cabecera del pedido (Cliente, Nota, etc.)
        // Usamos LIMIT 1 para evitar duplicidad si el cliente tiene múltiples características
        const headerData = await this.dataSourceLegacy.query(`
            SELECT 
                D.DOCID, D.CLIENTEID, D.NUMERO, D.SERIE, D.FECHA, D.TIPO, D.ESTADO, C.NOMBRE AS CLIENTE, D.NOTA, CLA.CLATEXTO
            FROM DOC D
            JOIN CLI C ON D.CLIENTEID = C.CLIENTEID
            LEFT OUTER JOIN CARCLI CAR ON D.CLIENTEID = CAR.CARID
            LEFT OUTER JOIN CLA ON CAR.CARACTERISTICA = CLA.CLAID
            WHERE D.DOCID = ? AND CLA.CLATEXTO IN ('01', '02')
            LIMIT 1
        `, [docId]);

        if (headerData.length === 0) {
          this.logger.warn(`DOCID ${docId} no retornó cabecera válida (posiblemente sin CLATEXTO 01/02), saltando.`);
          if (docId > maxProcesado) maxProcesado = docId;
          continue;
        }

        const header = headerData[0];

        // Obtenemos los detalles (Items) SIN hacer join con Cliente/Caracteristicas para evitar producto cartesiano
        const items = await this.dataSourceLegacy.query(`
            SELECT 
                I.ARTICULOID, I.CLVPROV, I.CLAVE, I.DESCRIPCIO, I.CODBAR, I.XIMAGEN2, DS.DESCANTIDAD, A.UBICACION
            FROM DES DS
            JOIN INV I ON DS.DESARTID = I.ARTICULOID
            LEFT JOIN ALM A ON I.ARTICULOID = A.ARTICULOID AND A.ALMACEN = 1
            WHERE DS.DESDOCID = ?
        `, [docId]);

        if (items.length === 0) {
          this.logger.warn(`DOCID ${docId} no retornó detalles, saltando.`);
          if (docId > maxProcesado) maxProcesado = docId;
          continue;
        }

        let requiereCuartoChico = false;
        const detallesAGuardar: DetalleTemp[] = [];

        for (const item of items) {
          let zona: Zona = Zona.AG;
          
          if (item.UBICACION && (
            item.UBICACION === 'PASILLO BA' || 
            item.UBICACION === 'POLVOS'
          )) {
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
             let requiresUpdate = false;
             
             if (producto.ubicacion !== item.UBICACION) {
               producto.ubicacion = item.UBICACION;
               producto.zonaAsignada = zona; // Actualizar zona en caso de cambio de ubicación
               requiresUpdate = true;
             }
             if (producto.img !== item.XIMAGEN2) {
               producto.img = item.XIMAGEN2;
               requiresUpdate = true;
             }
             if (producto.clave !== item.CLAVE) {
               producto.clave = item.CLAVE;
               requiresUpdate = true;
             }
             if (producto.nombre !== item.DESCRIPCIO) {
               producto.nombre = item.DESCRIPCIO;
               requiresUpdate = true;
             }
             if (producto.codbar !== item.CODBAR) {
               producto.codbar = item.CODBAR;
               requiresUpdate = true;
             }

             if (requiresUpdate) {
               await queryRunner.manager.save(producto);
             }
          }

           // --- PROCESAR CÓDIGOS DE EMPAQUETADO ---
          if (!productosProcesadosEnLote.has(producto.id)) {
            productosProcesadosEnLote.add(producto.id);
            
            const codigosDelProductoLegacy = codigosExtraMap.get(item.ARTICULOID) || [];
            
            // Obtener los códigos actuales en nuestra BD local para este producto
            const codigosLocales = await queryRunner.manager.find(ProductoCodigo, { 
              where: { producto: { id: producto.id } } 
            });

            // Mapear para facilitar comparación
            const setLegacy = new Set(codigosDelProductoLegacy.map(c => `${c.CODIGO}-${parseInt(String(c.PREFIJO).replace('*', ''), 10) || 1}`));
            const setLocal = new Set(codigosLocales.map(c => `${c.codigo}-${c.prefijo}`));

            // Si hay diferencias entre los de legacy y los locales, borramos e insertamos los nuevos
            let codigosDiferentes = setLegacy.size !== setLocal.size;
            if (!codigosDiferentes) {
              for (const cod of setLegacy) {
                if (!setLocal.has(cod)) {
                  codigosDiferentes = true;
                  break;
                }
              }
            }

            if (codigosDiferentes) {
              await queryRunner.manager.delete(ProductoCodigo, { producto: { id: producto.id } });

              for (const cod of codigosDelProductoLegacy) {
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

       
        const nota = header.NOTA || '';
        const esRecogeEnOficina = nota.includes('CLIENTE RECOGE EN OFICINA');

        const nuevoPedido = queryRunner.manager.create(Pedido, {
          idExternoDoc: docId,
          clienteId: header.CLIENTEID,
          folioExterno: header.NUMERO,
          serie: header.SERIE,
          clienteNombre: header.CLIENTE,
          fechaCreacion: header.FECHA || new Date(),
          requiereCuartoChico: requiereCuartoChico,
          clatexto: header.CLATEXTO == '01' ? 'TX' : 'QRO',
          statusGlobal: requiereCuartoChico ? StatusGlobal.ESPERA_CC : StatusGlobal.PENDIENTE_AG,
          esRecogeEnOficina: esRecogeEnOficina,
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

        if (docId > maxProcesado) {
            maxProcesado = docId;
        }

        await queryRunner.commitTransaction();
        this.logger.log(`Pedido con DOCID ${docId} importado correctamente.`);
        await this.tryAssociateLegacyDocumentWithMobileOrder(header, pedidoGuardado);

      } catch (err) {
        this.logger.error(`Error en transacción para DOCID ${docId}`, err);
        await queryRunner.rollbackTransaction();
      } finally {
        await queryRunner.release();
      }
    }

    // Actualizamos control al final de todo el lote
    const control = await this.controlRepo.findOne({ where: { id: 1 } });
    if (control) {
      control.ultimoDocId = maxProcesado;
      control.fechaEjecucion = new Date();
      await this.controlRepo.save(control);
      this.logger.log(`Sincronización de lote completada. Último DOCID procesado: ${maxProcesado}`);
    }
  }

  // --- NUEVA FUNCIONALIDAD: LIMPIEZA DE PEDIDOS FACTURADOS ---
  private async verificarPedidosFacturados() {
    // 1. Buscamos pedidos en 'sistemas' que estén activos (ni completados ni empaquetados)
    const pedidoRepo = this.dataSourceSistemas.getRepository(Pedido);
    
    const pedidosActivos = await pedidoRepo.find({
      where: {
        statusGlobal: Not(In([StatusGlobal.COMPLETADO, StatusGlobal.EMPAQUETADO, StatusGlobal.CANCELADO]))
      },
      select: ['id', 'idExternoDoc', 'esRecogeEnOficina'] // Solo necesitamos los IDs y la bandera de oficina
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
            fechaFinAg: new Date()
          }
        );

        const pedidosCerradosLog = await pedidoRepo.find({
          where: { idExternoDoc: In(idsFacturados) },
          select: ['id'],
        });

        for (const pedido of pedidosCerradosLog) {
          await this.logPedidoFechaTrace('verificarPedidosFacturados', pedido.id);
        }

        // --- Actualización específica para pedidos de Oficina ---
        const pedidosOficinaFacturados = pedidosActivos
          .filter(p => idsFacturados.includes(p.idExternoDoc) && p.esRecogeEnOficina);

        const idsOficinaFacturados = pedidosOficinaFacturados.map(p => p.idExternoDoc);

        if (idsOficinaFacturados.length > 0) {
          await pedidoRepo.update(
            { idExternoDoc: In(idsOficinaFacturados) },
            { statusEntrega: StatusEntrega.DISPONIBLE_OFICINA }
          );
          this.logger.log(`Se marcaron como disponibles en oficina ${idsOficinaFacturados.length} pedidos facturados.`);
          
          // Emitir evento para cada pedido actualizado
          for (const pedido of pedidosOficinaFacturados) {
            this.eventsGateway.emitirCambioStatusEntrega({ 
              idPedido: pedido.id, 
              nuevoStatusEntrega: StatusEntrega.DISPONIBLE_OFICINA 
            });
          }
        }
        
        this.logger.log(`Se cerraron ${idsFacturados.length} pedidos remotamente (Facturados en Legacy).`);

        // 4. Notificar por WebSocket para que los paneles se actualicen en tiempo real.
        // Buscamos los pedidos que acabamos de cerrar para obtener sus IDs internos.
        const pedidosCerrados = pedidosActivos.filter(p => idsFacturados.includes(p.idExternoDoc));

        // Emitimos un evento por cada uno.
        for (const pedido of pedidosCerrados) {
          this.eventsGateway.emitirCambioEstado({ idPedido: pedido.id, nuevoEstado: StatusGlobal.COMPLETADO });
        }

        await this.syncMobileOrdersFacturados(idsFacturados);
      }
    }
  }

  private async verificarPedidosCancelados() {
    const pedidoRepo = this.dataSourceSistemas.getRepository(Pedido);
    
    // 1. Buscamos pedidos que no estén ya en un estado final (Completado, Empaquetado o Cancelado)
    const pedidosActivos = await pedidoRepo.find({
      where: {
        statusGlobal: Not(In([
          StatusGlobal.COMPLETADO, 
          StatusGlobal.EMPAQUETADO,
          StatusGlobal.CANCELADO
        ]))
      },
      select: ['id', 'idExternoDoc']
    });

    if (pedidosActivos.length === 0) return;

    const idsExternos = pedidosActivos
      .map(p => p.idExternoDoc)
      .filter(id => id !== null && id !== undefined);

    if (idsExternos.length === 0) return;

    const chunkSize = 100;
    for (let i = 0; i < idsExternos.length; i += chunkSize) {
      const chunk = idsExternos.slice(i, i + chunkSize);
      
      if (chunk.length === 0) continue;

      // 2. Consultamos en Legacy cuáles de estos IDs tienen ESTADO = 'C' (Cancelado)
      const idsString = chunk.join(',');
      const cancelados = await this.dataSourceLegacy.query(`
        SELECT DOCID FROM DOC 
        WHERE DOCID IN (${idsString}) AND ESTADO = 'C'
      `);

      if (cancelados.length > 0) {
        const idsCancelados = cancelados.map((c: any) => c.DOCID);
        
        await pedidoRepo.update(
          { idExternoDoc: In(idsCancelados) },
          { statusGlobal: StatusGlobal.CANCELADO }
        );
        
        this.logger.log(`Se marcaron como cancelados ${idsCancelados.length} pedidos (Cancelados en Legacy).`);

        // 4. Notificar por WebSocket para que los paneles se actualicen en tiempo real.
        // Buscamos los pedidos que acabamos de cerrar para obtener sus IDs internos.
        const pedidosCancelados = pedidosActivos.filter(p => idsCancelados.includes(p.idExternoDoc));

        // Emitimos un evento por cada uno.
        for (const pedido of pedidosCancelados) {
          this.eventsGateway.emitirCambioEstado({ idPedido: pedido.id, nuevoEstado: StatusGlobal.CANCELADO });
        }

        await this.syncMobileOrdersCancelados(idsCancelados);
      }
    }
  }

  private async tryAssociateLegacyDocumentWithMobileOrder(header: any, pedido: Pedido) {
    const matchedReference = extractMobileReference(header?.NOTA);
    if (!matchedReference) {
      return;
    }
    const normalizedReference = normalizeMobileReference(matchedReference);
    if (!normalizedReference) {
      return;
    }

    const mobileOrdersRepository = this.dataSourceSistemas.getRepository(ClienteMobileOrder);
    const legacyDocumentsRepository = this.dataSourceSistemas.getRepository(
      ClienteMobileOrderLegacyDocument,
    );

    const mobileOrder = await mobileOrdersRepository.findOne({
      where: {
        mobileReference: normalizedReference,
      },
      relations: ['legacyDocuments'],
    });

    if (!mobileOrder) {
      this.logger.warn(
        `No se encontró pedido mobile para la referencia ${matchedReference} del DOCID ${header?.DOCID}.`,
      );
      return;
    }

    let legacyDocument = await legacyDocumentsRepository.findOne({
      where: {
        orderId: mobileOrder.id,
        legacyDocId: pedido.idExternoDoc,
      },
    });

    legacyDocument = legacyDocument ?? legacyDocumentsRepository.create({
      orderId: mobileOrder.id,
      legacyDocId: pedido.idExternoDoc,
    });

    legacyDocument.pedidoId = pedido.id ?? null;
    legacyDocument.legacyNumero = this.cleanNullableString(header?.NUMERO);
    legacyDocument.legacySerie = this.cleanNullableString(header?.SERIE);
    legacyDocument.legacyTipo = this.cleanNullableString(header?.TIPO);
    legacyDocument.legacyEstado = this.cleanNullableString(header?.ESTADO);
    legacyDocument.legacyNota = this.cleanNullableString(header?.NOTA);
    legacyDocument.matchedReference = matchedReference;
    legacyDocument.isFacturado = this.cleanNullableString(header?.ESTADO) === 'F';
    legacyDocument.facturadoAt = legacyDocument.isFacturado
      ? legacyDocument.facturadoAt ?? new Date()
      : null;

    await legacyDocumentsRepository.save(legacyDocument);

    const refreshedMobileOrder = await this.refreshMobileOrderLegacySummary(mobileOrder.id);
    if (
      refreshedMobileOrder
      && [
        ClienteMobileOrderStatus.SUBMITTED,
        ClienteMobileOrderStatus.ACCEPTED,
      ].includes(refreshedMobileOrder.status)
    ) {
      await this.mobileOrderWorkflowService.changeOrderStatus({
        orderId: refreshedMobileOrder.id,
        nextStatus: ClienteMobileOrderStatus.PACKING,
        source: 'sync',
        changedBy: 'sincronizacion.procesarPedidosPorIds',
        notifyCustomer: true,
        metadataSource: 'sincronizacion.procesarPedidosPorIds',
      });
    }
  }

  private async syncMobileOrdersFacturados(idsFacturados: number[]) {
    if (!idsFacturados.length) {
      return;
    }

    const legacyDocumentsRepository = this.dataSourceSistemas.getRepository(
      ClienteMobileOrderLegacyDocument,
    );

    const linkedDocuments = await legacyDocumentsRepository.find({
      where: {
        legacyDocId: In(idsFacturados),
      },
    });

    if (!linkedDocuments.length) {
      return;
    }

    const now = new Date();
    for (const document of linkedDocuments) {
      document.legacyEstado = 'F';
      document.isFacturado = true;
      document.facturadoAt = document.facturadoAt ?? now;
    }

    await legacyDocumentsRepository.save(linkedDocuments);

    const affectedOrderIds = [...new Set(linkedDocuments.map((document) => document.orderId))];
    for (const orderId of affectedOrderIds) {
      const mobileOrder = await this.refreshMobileOrderLegacySummary(orderId);
      if (
        !mobileOrder
        || !mobileOrder.allLegacyDocumentsInvoiced
        || ![
          ClienteMobileOrderStatus.PACKING,
          ClienteMobileOrderStatus.ACCEPTED,
        ].includes(mobileOrder.status)
      ) {
        continue;
      }

      await this.mobileOrderWorkflowService.changeOrderStatus({
        orderId: mobileOrder.id,
        nextStatus: ClienteMobileOrderStatus.READY_TO_SHIP,
        source: 'sync',
        changedBy: 'sincronizacion.verificarPedidosFacturados',
        notifyCustomer: true,
        metadataSource: 'sincronizacion.verificarPedidosFacturados',
      });
    }
  }

  private async syncMobileOrdersCancelados(idsCancelados: number[]) {
    if (!idsCancelados.length) {
      return;
    }

    const legacyDocumentsRepository = this.dataSourceSistemas.getRepository(
      ClienteMobileOrderLegacyDocument,
    );

    const linkedDocuments = await legacyDocumentsRepository.find({
      where: {
        legacyDocId: In(idsCancelados),
      },
    });

    if (!linkedDocuments.length) {
      return;
    }

    for (const document of linkedDocuments) {
      document.legacyEstado = 'C';
      document.isFacturado = false;
      document.facturadoAt = null;
    }

    await legacyDocumentsRepository.save(linkedDocuments);

    const affectedOrderIds = [...new Set(linkedDocuments.map((document) => document.orderId))];
    for (const orderId of affectedOrderIds) {
      const mobileOrder = await this.refreshMobileOrderLegacySummary(orderId);
      if (
        !mobileOrder
        || ![
          ClienteMobileOrderStatus.SUBMITTED,
          ClienteMobileOrderStatus.ACCEPTED,
          ClienteMobileOrderStatus.PACKING,
          ClienteMobileOrderStatus.READY_TO_SHIP,
        ].includes(mobileOrder.status)
      ) {
        continue;
      }

      const orderDocuments = await legacyDocumentsRepository.find({
        where: { orderId: mobileOrder.id },
      });
      const allLegacyDocumentsCancelled = orderDocuments.length > 0
        && orderDocuments.every((document) => this.cleanNullableString(document.legacyEstado) === 'C');

      if (!allLegacyDocumentsCancelled) {
        continue;
      }

      await this.mobileOrderWorkflowService.changeOrderStatus({
        orderId: mobileOrder.id,
        nextStatus: ClienteMobileOrderStatus.CANCELLED,
        source: 'sync',
        changedBy: 'sincronizacion.verificarPedidosCancelados',
        notifyCustomer: true,
        metadataSource: 'sincronizacion.verificarPedidosCancelados',
      });
    }
  }

  private async refreshMobileOrderLegacySummary(orderId: number) {
    const mobileOrdersRepository = this.dataSourceSistemas.getRepository(ClienteMobileOrder);
    const legacyDocumentsRepository = this.dataSourceSistemas.getRepository(
      ClienteMobileOrderLegacyDocument,
    );

    const documents = await legacyDocumentsRepository.find({
      where: { orderId },
    });

    const totalDocuments = documents.length;
    const allLegacyDocumentsInvoiced = totalDocuments > 0
      && documents.every((document) => Boolean(document.isFacturado));

    await mobileOrdersRepository.update(
      { id: orderId },
      {
        legacyDocumentsCount: totalDocuments,
        allLegacyDocumentsInvoiced,
        lastLegacySyncAt: new Date(),
      },
    );

    return mobileOrdersRepository.findOne({
      where: { id: orderId },
    });
  }

  private cleanNullableString(value: unknown) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
    
}
