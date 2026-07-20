import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IclockTransaction } from './entities/iclock-transaction.entity';
import { AttLeave } from './entities/att-leave.entity';
import { PersonnelDepartment } from './entities/personnel-department.entity';
import { PersonnelPosition } from './entities/personnel-position.entity';
import { PersonnelEmployee } from './entities/personnel-employee.entity';
import { PersonnelResign } from './entities/personnel-resign.entity';
import { GetAsistenciaDto } from './dto/get-asistencia.dto';
import * as ExcelJS from 'exceljs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export type CalendarWeekdayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
export type MonthlyWarehouseCalendarAttendanceStatus = 'absence' | 'leave';

export interface MonthlyWarehouseCalendarEmployee {
  employeeId: number;
  fullName: string;
  hireDate: string | null;
  activeDays: number;
  attendanceStatus: MonthlyWarehouseCalendarAttendanceStatus;
  leaveId: number | null;
  leaveCategoryId: number | null;
  leaveCategoryName: string | null;
  leaveDurationHours: number | null;
  leaveStartTime: string | null;
  leaveEndTime: string | null;
  leaveReason: string | null;
}

export interface MonthlyWarehouseCalendarResignation {
  id: number;
  employeeId: number;
  fullName: string;
  resignDate: string;
  resignType: number | null;
  disableAttendance: boolean;
  reason: string | null;
}

export interface MonthlyWarehouseCalendarDay {
  weekday: CalendarWeekdayKey;
  weekdayLabel: string;
  date: string | null;
  dayNumber: number | null;
  employees: MonthlyWarehouseCalendarEmployee[];
}

export interface MonthlyWarehouseCalendarWeek {
  weekIndex: number;
  days: MonthlyWarehouseCalendarDay[];
  resignations: MonthlyWarehouseCalendarResignation[];
}

@Injectable()
export class AsistenciaService {
  private readonly logger = new Logger(AsistenciaService.name);

  constructor(
    @InjectRepository(IclockTransaction, 'zkteco_db')
    private readonly transactionRepositoryPrincipal: Repository<IclockTransaction>,
    @InjectRepository(AttLeave, 'zkteco_db')
    private readonly leaveRepositoryPrincipal: Repository<AttLeave>,
    @InjectRepository(PersonnelDepartment, 'zkteco_db')
    private readonly departmentRepositoryPrincipal: Repository<PersonnelDepartment>,
    @InjectRepository(PersonnelPosition, 'zkteco_db')
    private readonly positionRepositoryPrincipal: Repository<PersonnelPosition>,
    @InjectRepository(PersonnelEmployee, 'zkteco_db')
    private readonly employeeRepositoryPrincipal: Repository<PersonnelEmployee>,
    @InjectRepository(PersonnelResign, 'zkteco_db')
    private readonly resignRepositoryPrincipal: Repository<PersonnelResign>,
    
    @InjectRepository(IclockTransaction, 'zkteco_tequis_db')
    private readonly transactionRepositoryTequis: Repository<IclockTransaction>,
    @InjectRepository(AttLeave, 'zkteco_tequis_db')
    private readonly leaveRepositoryTequis: Repository<AttLeave>,
    @InjectRepository(PersonnelDepartment, 'zkteco_tequis_db')
    private readonly departmentRepositoryTequis: Repository<PersonnelDepartment>,
    @InjectRepository(PersonnelPosition, 'zkteco_tequis_db')
    private readonly positionRepositoryTequis: Repository<PersonnelPosition>,
    @InjectRepository(PersonnelEmployee, 'zkteco_tequis_db')
    private readonly employeeRepositoryTequis: Repository<PersonnelEmployee>,

    private readonly dataSourceSistemas: DataSource, // Para consultar la IP dinámica
  ) {}

  // Método auxiliar para obtener el repositorio correcto según la sucursal solicitada
  private async getRepositories(sucursal?: 'principal' | 'tequisquiapan') {
    if (sucursal === 'tequisquiapan') {
      // Obtener la IP dinámica de la base de datos de sistemas
      try {
        const result = await this.dataSourceSistemas.query(`SELECT ipv4 FROM sucursales WHERE id = 1 LIMIT 1`);
        if (result && result.length > 0 && result[0].ipv4) {
          const ipPublica = result[0].ipv4;
          
          // Actualizar dinámicamente el host de la conexión de TypeORM para Tequisquiapan
          const tequisConnection = this.transactionRepositoryTequis.manager.connection;
          // Castear a any para acceder a la propiedad host sin errores de typescript
          const currentOptions = tequisConnection.options as any;
          
          if (currentOptions.host !== ipPublica) {
            this.logger.log(`Actualizando IP de conexión Tequisquiapan a: ${ipPublica}`);
            // typeorm no permite cambiar opciones directamente tan fácil una vez inicializado, 
            // pero podemos modificar el objeto de opciones interno si no está conectada o destruirla y reconectarla
            if (tequisConnection.isInitialized) {
              await tequisConnection.destroy();
            }
            Object.assign(tequisConnection.options, { host: ipPublica });
            await tequisConnection.initialize();
          }
        }
      } catch (error) {
        this.logger.error('Error al obtener la IP de la sucursal de la BD de sistemas', error);
      }

      return {
        transaction: this.transactionRepositoryTequis,
        leave: this.leaveRepositoryTequis,
        department: this.departmentRepositoryTequis,
        position: this.positionRepositoryTequis,
        employee: this.employeeRepositoryTequis,
      };
    }

    // Por defecto devuelve la principal
    return {
      transaction: this.transactionRepositoryPrincipal,
      leave: this.leaveRepositoryPrincipal,
      department: this.departmentRepositoryPrincipal,
      position: this.positionRepositoryPrincipal,
      employee: this.employeeRepositoryPrincipal,
    };
  }

  async obtenerReporteAlmacenistasMensual() {
    const terminalId = 3;
    const departmentId = 2;
    const sucursal = 'principal' as const;
    const monthWindow = this.getCurrentMonthWindow();
    const effectiveEndDate = monthWindow.effectiveEndDate;

    const activeEmployees = await this.employeeRepositoryPrincipal.createQueryBuilder('employee')
      .where('employee.department_id = :departmentId', { departmentId })
      .andWhere('employee.status = :activeStatus', { activeStatus: 0 })
      .andWhere('employee.hire_date IS NOT NULL')
      .andWhere('employee.hire_date <= :endDate', { endDate: effectiveEndDate })
      .orderBy('employee.first_name', 'ASC')
      .addOrderBy('employee.last_name', 'ASC')
      .getMany();

    const resignations = await this.resignRepositoryPrincipal.createQueryBuilder('resignation')
      .leftJoinAndSelect('resignation.employee', 'employee')
      .where('employee.department_id = :departmentId', { departmentId })
      .andWhere('resignation.resign_date >= :startDate', { startDate: monthWindow.startDate })
      .andWhere('resignation.resign_date <= :endDate', { endDate: effectiveEndDate })
      .orderBy('resignation.resign_date', 'ASC')
      .addOrderBy('employee.first_name', 'ASC')
      .addOrderBy('employee.last_name', 'ASC')
      .getMany();

    const resignedEmployeeIds = Array.from(
      new Set(
        resignations
          .map((resignation) => resignation.employee_id)
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    );

    const resignationWeekWindows = new Map<number, { startDate: string; endDate: string }>();
    for (const resignation of resignations) {
      resignationWeekWindows.set(
        resignation.employee_id,
        this.getWeekWindowFromDate(resignation.resign_date, effectiveEndDate),
      );
    }

    const resignedEntries = resignedEmployeeIds.length > 0
      ? await this.transactionRepositoryPrincipal.createQueryBuilder('transaction')
          .select(['transaction.emp_id AS emp_id', 'transaction.punch_time AS punch_time'])
          .where('transaction.emp_id IN (:...employeeIds)', { employeeIds: resignedEmployeeIds })
          .andWhere('transaction.terminal_id = :terminalId', { terminalId })
          .andWhere('transaction.punch_state = :punchState', { punchState: '0' })
          .andWhere('transaction.punch_time BETWEEN :start AND :end', {
            start: `${monthWindow.startDate}T00:00:00.000-06:00`,
            end: `${effectiveEndDate}T23:59:59.999-06:00`,
          })
          .orderBy('transaction.punch_time', 'ASC')
          .getRawMany<{ emp_id: string; punch_time: Date | string }>()
      : [];

    const resignedEmployeesWithWeekEntries = new Set<number>();
    for (const transaction of resignedEntries) {
      const employeeId = Number(transaction.emp_id);
      const transactionDate = this.getTransactionLocalDateKey(transaction.punch_time);
      const weekWindow = resignationWeekWindows.get(employeeId);

      if (!weekWindow) {
        continue;
      }

      if (transactionDate >= weekWindow.startDate && transactionDate <= weekWindow.endDate) {
        resignedEmployeesWithWeekEntries.add(employeeId);
      }
    }

    const resignedEmployees = resignations
      .filter((resignation) => resignedEmployeesWithWeekEntries.has(resignation.employee_id))
      .map((resignation) => resignation.employee)
      .filter((employee): employee is PersonnelEmployee => !!employee);

    const employees = Array.from(
      new Map(
        [...activeEmployees, ...resignedEmployees].map((employee) => [employee.id, employee]),
      ).values(),
    ).sort((left, right) => {
      const leftName = this.getEmployeeFullName(left);
      const rightName = this.getEmployeeFullName(right);
      return leftName.localeCompare(rightName, 'es-MX');
    });

    const employeeIds = employees.map((employee) => employee.id);

    const monthlyLeaves = employeeIds.length > 0
      ? await this.leaveRepositoryPrincipal.createQueryBuilder('attLeave')
          .leftJoinAndSelect('attLeave.category', 'category')
          .where('attLeave.employee_id IN (:...employeeIds)', { employeeIds })
          .andWhere('attLeave.start_time <= :endDateTime', {
            endDateTime: `${effectiveEndDate}T23:59:59.999-06:00`,
          })
          .andWhere('attLeave.end_time >= :startDateTime', {
            startDateTime: `${monthWindow.startDate}T00:00:00.000-06:00`,
          })
          .orderBy('attLeave.start_time', 'ASC')
          .getMany()
      : [];

    const resignationMap = new Map<number, string>();
    for (const resignation of resignations) {
      if (!resignationMap.has(resignation.employee_id)) {
        resignationMap.set(resignation.employee_id, resignation.resign_date);
      }
    }

    const entryTransactions = employeeIds.length > 0
      ? await this.transactionRepositoryPrincipal.createQueryBuilder('transaction')
          .select(['transaction.emp_id AS emp_id', 'transaction.punch_time AS punch_time'])
          .where('transaction.emp_id IN (:...employeeIds)', { employeeIds })
          .andWhere('transaction.terminal_id = :terminalId', { terminalId })
          .andWhere('transaction.punch_state = :punchState', { punchState: '0' })
          .andWhere('transaction.punch_time BETWEEN :start AND :end', {
            start: `${monthWindow.startDate}T00:00:00.000-06:00`,
            end: `${effectiveEndDate}T23:59:59.999-06:00`,
          })
          .orderBy('transaction.punch_time', 'ASC')
          .getRawMany<{ emp_id: string; punch_time: Date | string }>()
      : [];

    const employeesWithEntryByDate = new Map<string, Set<number>>();
    for (const transaction of entryTransactions) {
      const employeeId = Number(transaction.emp_id);
      const dateKey = this.getTransactionLocalDateKey(transaction.punch_time);

      if (!employeesWithEntryByDate.has(dateKey)) {
        employeesWithEntryByDate.set(dateKey, new Set<number>());
      }

      employeesWithEntryByDate.get(dateKey)?.add(employeeId);
    }

    const leavesByEmployeeAndDate = new Map<string, AttLeave[]>();
    for (const leave of monthlyLeaves) {
      const leaveStartDate = this.getDateTimeLocalDateKey(leave.start_time);
      const leaveEndDate = this.getDateTimeLocalDateKey(leave.end_time);
      const rangeStartDate = leaveStartDate > monthWindow.startDate ? leaveStartDate : monthWindow.startDate;
      const rangeEndDate = leaveEndDate < effectiveEndDate ? leaveEndDate : effectiveEndDate;

      if (rangeStartDate > rangeEndDate) {
        continue;
      }

      for (const date of this.getBusinessDatesBetween(rangeStartDate, rangeEndDate)) {
        const key = `${leave.employee_id}|${date}`;
        if (!leavesByEmployeeAndDate.has(key)) {
          leavesByEmployeeAndDate.set(key, []);
        }

        leavesByEmployeeAndDate.get(key)?.push(leave);
      }
    }

    const employeesByDate = new Map<string, MonthlyWarehouseCalendarEmployee[]>();
    for (const date of this.getBusinessDatesBetween(monthWindow.startDate, effectiveEndDate)) {
      const employeesWithEntry = employeesWithEntryByDate.get(date) ?? new Set<number>();
      const absentEmployees: MonthlyWarehouseCalendarEmployee[] = employees
        .filter((employee) => this.isEmployeeActiveOnDate(employee, resignationMap.get(employee.id) ?? null, date))
        .filter((employee) => !employeesWithEntry.has(employee.id))
        .map((employee) => {
          const leaveSummary = this.summarizeLeaveEntries(
            leavesByEmployeeAndDate.get(`${employee.id}|${date}`) ?? [],
          );

          return {
            employeeId: employee.id,
            fullName: this.getEmployeeFullName(employee),
            hireDate: employee.hire_date,
            activeDays: this.getActiveDays(employee.hire_date, date),
            attendanceStatus: leaveSummary ? ('leave' as const) : ('absence' as const),
            leaveId: leaveSummary?.leaveId ?? null,
            leaveCategoryId: leaveSummary?.leaveCategoryId ?? null,
            leaveCategoryName: leaveSummary?.leaveCategoryName ?? null,
            leaveDurationHours: leaveSummary?.leaveDurationHours ?? null,
            leaveStartTime: leaveSummary?.leaveStartTime ?? null,
            leaveEndTime: leaveSummary?.leaveEndTime ?? null,
            leaveReason: leaveSummary?.leaveReason ?? null,
          };
        });

      employeesByDate.set(date, absentEmployees);
    }

    const monthlyResignations = resignations
      .filter((resignation) => resignation.resign_date >= monthWindow.startDate)
      .map<MonthlyWarehouseCalendarResignation>((resignation) => ({
        id: resignation.id,
        employeeId: resignation.employee_id,
        fullName: this.getEmployeeFullName(resignation.employee),
        resignDate: resignation.resign_date,
        resignType: resignation.resign_type,
        disableAttendance: resignation.disableatt,
        reason: resignation.reason,
      }));

    const weeks = this.buildMonthlyCalendarWeeks(
      monthWindow.startDate,
      monthWindow.endDate,
      employeesByDate,
      monthlyResignations,
    );

    return {
      filters: {
        departmentId,
        sucursal,
        terminalId,
      },
      window: {
        startDate: monthWindow.startDate,
        endDate: monthWindow.endDate,
        effectiveEndDate,
        monthLabel: this.getMonthLabel(monthWindow.startDate),
      },
      headers: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Bajas'],
      weeks,
      totals: {
        employees: employees.length,
        resignations: monthlyResignations.length,
        permissions: Array.from(employeesByDate.values())
          .flat()
          .filter((employee) => employee.attendanceStatus === 'leave').length,
      },
    };
  }

  async obtenerReporte(dto: GetAsistenciaDto) {
    const repos = await this.getRepositories(dto.sucursal);
    
    // Cambiamos la base de la consulta a employee para poder traer a todos,
    // incluso si no tienen registros de asistencia (LEFT JOIN).
    const query = repos.employee.createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.position', 'position')
      .where('employee.status = :status', { status: 0 }); // Filtramos solo empleados activos (status 0)

    let txConditions = 'transaction.emp_id = employee.id';
    const txParams: any = {};

    if (dto.startDate && dto.endDate) {
      // Ajustar fechas considerando la zona horaria de México (-06:00)
      const startDateStr = `${dto.startDate}T00:00:00.000-06:00`;
      const endDateStr = `${dto.endDate}T23:59:59.999-06:00`;
      
      txConditions += ' AND transaction.punch_time BETWEEN :start AND :end';
      txParams.start = startDateStr;
      txParams.end = endDateStr;
    } else if (dto.startDate) {
      const startDateStr = `${dto.startDate}T00:00:00.000-06:00`;
      txConditions += ' AND transaction.punch_time >= :start';
      txParams.start = startDateStr;
    } else if (dto.endDate) {
      const endDateStr = `${dto.endDate}T23:59:59.999-06:00`;
      txConditions += ' AND transaction.punch_time <= :end';
      txParams.end = endDateStr;
    }

    if (dto.terminalId) {
      txConditions += ' AND transaction.terminal_id = :terminalId';
      txParams.terminalId = dto.terminalId;
    }

    // Realizar el LEFT JOIN con la tabla de transacciones, filtrando en la misma condición ON
    query.leftJoinAndSelect('employee.transactions', 'transaction', txConditions, txParams);

    if (dto.departmentId) {
      query.andWhere('department.id = :departmentId', { departmentId: dto.departmentId });
    }

    if (dto.positionId) {
      query.andWhere('position.id = :positionId', { positionId: dto.positionId });
    }

    // Limitar temporalmente para ver si hay datos sin filtro
    if(!dto.startDate && !dto.endDate && !dto.departmentId && !dto.positionId && !dto.terminalId) {
       query.take(50); // Limitar a 50 empleados por si hay muchos
    }

    // Ordenar primero por empleado y luego por la hora de su asistencia
    query.orderBy('employee.first_name', 'ASC')
         .addOrderBy('employee.last_name', 'ASC')
         .addOrderBy('transaction.punch_time', 'DESC');

    console.log('Consulta SQL generada:', query.getSql());
    console.log('Parámetros de consulta:', query.getParameters());

    const employees = await query.getMany();
    const employeeIds = employees.map((employee) => employee.id);
    const leavePermissionsByEmployee = new Map<number, Array<{
      leaveId: number;
      categoryId: number | null;
      categoryName: string;
      durationHours: number;
      startTime: string;
      endTime: string;
      applyReason: string | null;
      startDate: string;
      endDate: string;
    }>>();

    if (employeeIds.length > 0 && (dto.startDate || dto.endDate)) {
      const leaveQuery = repos.leave.createQueryBuilder('attLeave')
        .leftJoinAndSelect('attLeave.category', 'category')
        .where('attLeave.employee_id IN (:...employeeIds)', { employeeIds });

      if (dto.startDate) {
        leaveQuery.andWhere('attLeave.end_time >= :leaveStartDate', {
          leaveStartDate: `${dto.startDate}T00:00:00.000-06:00`,
        });
      }

      if (dto.endDate) {
        leaveQuery.andWhere('attLeave.start_time <= :leaveEndDate', {
          leaveEndDate: `${dto.endDate}T23:59:59.999-06:00`,
        });
      }

      const leaves = await leaveQuery
        .orderBy('attLeave.start_time', 'ASC')
        .getMany();

      for (const leave of leaves) {
        if (!leavePermissionsByEmployee.has(leave.employee_id)) {
          leavePermissionsByEmployee.set(leave.employee_id, []);
        }

        leavePermissionsByEmployee.get(leave.employee_id)?.push({
          leaveId: leave.abstractexception_ptr_id,
          categoryId: leave.category_id,
          categoryName: leave.category?.category_name?.trim() || 'Permiso',
          durationHours: this.getDateRangeDurationHours(leave.start_time, leave.end_time),
          startTime: this.formatLocalDateTime(leave.start_time),
          endTime: this.formatLocalDateTime(leave.end_time),
          applyReason: leave.apply_reason?.trim() || null,
          startDate: this.getDateTimeLocalDateKey(leave.start_time),
          endDate: this.getDateTimeLocalDateKey(leave.end_time),
        });
      }
    }

    // Aplanar los resultados para mantener la estructura compatible con el Frontend y el Excel
    const result: any[] = [];
    for (const emp of employees) {
      const { transactions, ...empData } = emp;
      const employeeWithPermissions = {
        ...empData,
        leavePermissions: leavePermissionsByEmployee.get(emp.id) ?? [],
      };

      if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
          result.push({
            ...tx,
            employee: employeeWithPermissions,
          });
        }
      } else {
        // Empleado sin asistencia registrada en ese periodo/terminal
        result.push({
          id: null,
          emp_code: emp.emp_code,
          punch_time: null,
          punch_state: 'Sin Registro',
          verify_type: null,
          employee: employeeWithPermissions,
        });
      }
    }

    // Mapear el resultado para formatear la fecha a la zona horaria local
    return result.map(tx => {
      // Si la fecha existe, ajustarla al formato local YYYY-MM-DD HH:mm:ss
      let formattedTime: string | null = null;
      if (tx.punch_time) {
        // En PostgreSQL (ZKTeco) la fecha se guardó como si el servidor de BioTime 
        // estuviera desfasado por 1 hora adicional a nuestra configuración local.
        // Sumamos 1 hora (3600000 ms) manualmente a la fecha obtenida para que 
        // empate con la realidad (08:36:27 -> 09:36:27).
        const date = new Date(tx.punch_time.getTime() + 3600000);
        
        // Formatear manualmente para evitar que JSON.stringify lo vuelva a convertir a UTC (Z)
        const pad = (n: number) => n.toString().padStart(2, '0');
        formattedTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      }
      
      return {
        ...tx,
        punch_time: formattedTime as any // as any para evitar problemas de tipado con la entidad que espera Date
      };
    });
  }

  async obtenerReporteDiaActual(dto: GetAsistenciaDto) {
    // Generar la fecha en formato YYYY-MM-DD considerando la zona horaria local
    const now = new Date();
    // Ajustar offset para evitar que UTC cambie el día
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, -1);
    
    const startDate = localISOTime.split('T')[0];
    const endDate = localISOTime.split('T')[0];
    
    console.log(`Buscando registros para el día actual: ${startDate}`);
    
    return this.obtenerReporte({ ...dto, startDate, endDate });
  }

  async generarExcel(datos: any[]): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Asistencia');

    worksheet.columns = [
      { header: 'ID Empleado', key: 'emp_code', width: 15 },
      { header: 'Nombre', key: 'first_name', width: 20 },
      { header: 'Apellido', key: 'last_name', width: 20 },
      { header: 'Departamento', key: 'department', width: 25 },
      { header: 'Posición', key: 'position', width: 25 },
      { header: 'Fecha y Hora', key: 'punch_time', width: 25 },
      { header: 'Estado', key: 'punch_state', width: 15 },
    ];

    // Estilo de la cabecera
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { horizontal: 'center' };

    datos.forEach(tx => {
      worksheet.addRow({
        emp_code: tx.employee?.emp_code || tx.emp_code,
        first_name: tx.employee?.first_name || '',
        last_name: tx.employee?.last_name || '',
        department: tx.employee?.department?.dept_name || 'Sin Asignar',
        position: tx.employee?.position?.position_name || 'Sin Asignar',
        punch_time: tx.punch_time ? tx.punch_time : '', // Ya viene formateado del map anterior
        punch_state: tx.punch_state,
      });
    });

    return workbook;
  }

  async obtenerDepartamentos(dto: GetAsistenciaDto) {
    const repos = await this.getRepositories(dto.sucursal);
    
    return repos.department.find({
      select: ['id', 'dept_name'],
      order: {
        dept_name: 'ASC'
      }
    });
  }

  async obtenerPosiciones(dto: GetAsistenciaDto) {
    const repos = await this.getRepositories(dto.sucursal);
    
    const posiciones = await repos.position.find({
      relations: ['parent_position'],
      order: {
        position_name: 'ASC'
      }
    });

    return posiciones.map(pos => ({
      id: pos.id,
      position_name: pos.position_name,
      parent_position_id: pos.parent_position_id,
      parent_position_name: pos.parent_position?.position_name || null
    }));
  }

  async generarRespaldoBiotime(dto: GetAsistenciaDto) {
    try {
      // Configuramos el directorio dentro de uploads para que pueda ser descargable si se necesita después
      const backupDir = path.join(process.cwd(), 'uploads', 'backups', 'biotime');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Obtener credenciales dinámicas o por defecto dependiendo de la sucursal elegida
      const repos = await this.getRepositories(dto.sucursal);
      const connection = repos.transaction.manager.connection;
      const options = connection.options as any;

      const host = options.host;
      const port = options.port;
      const user = options.username;
      const password = options.password;
      const database = options.database;

      const date = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateString = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
      
      const prefix = dto.sucursal === 'tequisquiapan' ? 'tequis' : 'principal';
      const fileName = `biotime_${prefix}_${dateString}.sql`;
      const filePath = path.join(backupDir, fileName);

      // Usar variable de entorno temporal para pasar el password a pg_dump de forma segura
      const env = { ...process.env, PGPASSWORD: password };
      
      // pg_dump genera el respaldo completo (estructura y datos). 
      // Usamos -F p (plain text) para que sea un .sql legible y fácil de restaurar
      const command = `pg_dump -h ${host} -p ${port} -U ${user} -F p -d ${database} -f "${filePath}"`;
      
      this.logger.log(`Ejecutando respaldo: ${command.replace(password, '***')}`);
      
      // Ejecutar el comando en el sistema operativo
      await execAsync(command, { env });
      
      this.logger.log(`Respaldo generado exitosamente en: ${filePath}`);

      return {
        success: true,
        message: 'Respaldo generado exitosamente',
        fileName,
        path: filePath,
        downloadUrl: `/uploads/backups/biotime/${fileName}`
      };
    } catch (error) {
      this.logger.error('Error al generar respaldo de BioTime', error);
      throw new Error('No se pudo generar el respaldo. Revisa si pg_dump está instalado: ' + error.message);
    }
  }

  private getCurrentMonthWindow() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      startDate: this.formatLocalDate(start),
      endDate: this.formatLocalDate(end),
      effectiveEndDate: this.formatLocalDate(today <= end ? today : end),
    };
  }

  private buildMonthlyCalendarWeeks(
    startDate: string,
    endDate: string,
    employeesByDate: Map<string, MonthlyWarehouseCalendarEmployee[]>,
    resignations: MonthlyWarehouseCalendarResignation[],
  ): MonthlyWarehouseCalendarWeek[] {
    const start = this.parseLocalDate(startDate);
    const end = this.parseLocalDate(endDate);
    const firstWeekStart = this.getStartOfWeek(start);
    const weeks: MonthlyWarehouseCalendarWeek[] = [];
    let cursor = new Date(firstWeekStart);

    while (cursor <= end) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 4);

      const days: MonthlyWarehouseCalendarDay[] = Array.from({ length: 5 }, (_, index) => {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + index);
        const isoDate = this.formatLocalDate(currentDate);
        const isInsideMonth = currentDate >= start && currentDate <= end;
        const weekday = this.getWeekdayKey(index);

        return {
          weekday,
          weekdayLabel: this.getWeekdayLabel(weekday),
          date: isInsideMonth ? isoDate : null,
          dayNumber: isInsideMonth ? currentDate.getDate() : null,
          employees: isInsideMonth ? (employeesByDate.get(isoDate) ?? []) : [],
        };
      });

      const weekResignations = resignations.filter((resignation) => (
        resignation.resignDate >= startDate &&
        resignation.resignDate <= endDate &&
        resignation.resignDate >= this.formatLocalDate(weekStart) &&
        resignation.resignDate <= this.formatLocalDate(weekEnd)
      ));

      weeks.push({
        weekIndex: weeks.length + 1,
        days,
        resignations: weekResignations,
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
  }

  private getBusinessDatesBetween(startDate: string, endDate: string) {
    const start = this.parseLocalDate(startDate);
    const end = this.parseLocalDate(endDate);
    const dates: string[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      if (cursor.getDay() >= 1 && cursor.getDay() <= 5) {
        dates.push(this.formatLocalDate(cursor));
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private isEmployeeActiveOnDate(
    employee: PersonnelEmployee,
    resignDate: string | null,
    currentDate: string,
  ) {
    if (!employee.hire_date) {
      return false;
    }

    if (employee.hire_date > currentDate) {
      return false;
    }

    if (resignDate && currentDate > resignDate) {
      return false;
    }

    return true;
  }

  private getActiveDays(hireDate: string | null, currentDate: string) {
    if (!hireDate) {
      return 0;
    }

    const hire = this.parseLocalDate(hireDate);
    const current = this.parseLocalDate(currentDate);
    const diffInMs = current.getTime() - hire.getTime();
    const diffInDays = Math.max(0, Math.floor(diffInMs / 86400000) + 1);

    return Math.min(diffInDays, 365);
  }

  private summarizeLeaveEntries(leaves: AttLeave[]) {
    if (!leaves.length) {
      return null;
    }

    const orderedLeaves = [...leaves].sort(
      (left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
    );
    const categoryNames = Array.from(
      new Set(
        orderedLeaves
          .map((leave) => leave.category?.category_name?.trim())
          .filter((value): value is string => !!value),
      ),
    );
    const reasons = Array.from(
      new Set(
        orderedLeaves
          .map((leave) => leave.apply_reason?.trim())
          .filter((value): value is string => !!value),
      ),
    );
    const startTime = orderedLeaves.reduce(
      (min, leave) => {
        const current = new Date(leave.start_time);
        return current < min ? current : min;
      },
      new Date(orderedLeaves[0].start_time),
    );
    const endTime = orderedLeaves.reduce(
      (max, leave) => {
        const current = new Date(leave.end_time);
        return current > max ? current : max;
      },
      new Date(orderedLeaves[0].end_time),
    );
    const totalDurationHours = orderedLeaves.reduce((sum, leave) => (
      sum + Math.max(0, new Date(leave.end_time).getTime() - new Date(leave.start_time).getTime())
    ), 0) / 3600000;

    return {
      leaveId: orderedLeaves[0].abstractexception_ptr_id,
      leaveCategoryId: orderedLeaves[0].category_id,
      leaveCategoryName: categoryNames.length ? categoryNames.join(' / ') : 'Permiso',
      leaveDurationHours: Number(totalDurationHours.toFixed(2)),
      leaveStartTime: this.formatLocalDateTime(startTime),
      leaveEndTime: this.formatLocalDateTime(endTime),
      leaveReason: reasons.length ? reasons.join(' / ') : null,
    };
  }

  private getDateRangeDurationHours(start: Date | string, end: Date | string) {
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    const durationHours = Math.max(0, endDate.getTime() - startDate.getTime()) / 3600000;
    return Number(durationHours.toFixed(2));
  }

  private getEmployeeFullName(employee?: Pick<PersonnelEmployee, 'first_name' | 'last_name'> | null) {
    const parts = [employee?.first_name?.trim(), employee?.last_name?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Sin nombre';
  }

  private getMonthLabel(date: string) {
    const baseDate = this.parseLocalDate(date);
    const month = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(baseDate);
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${baseDate.getFullYear()}`;
  }

  private getStartOfWeek(date: Date) {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    return result;
  }

  private getWeekWindowFromDate(date: string, maxDate: string) {
    const currentDate = this.parseLocalDate(date);
    const weekStart = this.getStartOfWeek(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);
    const maxWeekEnd = this.parseLocalDate(maxDate);

    return {
      startDate: this.formatLocalDate(weekStart),
      endDate: this.formatLocalDate(weekEnd <= maxWeekEnd ? weekEnd : maxWeekEnd),
    };
  }

  private getWeekdayKey(index: number): CalendarWeekdayKey {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'][index] as CalendarWeekdayKey;
  }

  private getWeekdayLabel(weekday: CalendarWeekdayKey) {
    const labels: Record<CalendarWeekdayKey, string> = {
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miercoles',
      thursday: 'Jueves',
      friday: 'Viernes',
    };

    return labels[weekday];
  }

  private parseLocalDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatLocalDate(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatLocalDateTime(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    const adjustedDate = new Date(date.getTime() + 3600000);
    const year = adjustedDate.getFullYear();
    const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getDate()).padStart(2, '0');
    const hours = String(adjustedDate.getHours()).padStart(2, '0');
    const minutes = String(adjustedDate.getMinutes()).padStart(2, '0');
    const seconds = String(adjustedDate.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private getTransactionLocalDateKey(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    const adjustedDate = new Date(date.getTime() + 3600000);
    return this.formatLocalDate(adjustedDate);
  }

  private getDateTimeLocalDateKey(value: Date | string) {
    return this.getTransactionLocalDateKey(value);
  }
}
