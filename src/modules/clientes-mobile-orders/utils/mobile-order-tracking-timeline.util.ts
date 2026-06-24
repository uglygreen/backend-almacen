import {
  ClienteMobileOrderDeliveryType,
  ClienteMobileOrderStatus,
} from '../entities/cliente-mobile-order.entity';

export type MobileOrderTrackingTimelineItem = {
  key: string;
  step:
    | 'created'
    | 'submitted'
    | 'accepted'
    | 'packing'
    | 'ready_to_ship'
    | 'in_route'
    | 'delivered'
    | 'cancelled'
    | 'documents'
    | 'invoiced';
  stepLabel: string;
  type:
    | 'order_created'
    | 'order_submitted'
    | 'status_changed'
    | 'legacy_document_created'
    | 'legacy_document_invoiced'
    | 'legacy_document_cancelled';
  title: string;
  message: string | null;
  occurredAt: Date | null;
  status: string | null;
  source: 'mobile' | 'backoffice' | 'sync' | 'legacy';
  changedBy: string | null;
  notifyCustomer: boolean;
  isCurrentStep: boolean;
  isCompletedStep: boolean;
  isTerminalStep: boolean;
  legacyDocId: number | null;
  pedidoId: number | null;
  folio: string | null;
  metadata: Record<string, any>;
};

type MobileOrderPrimaryTrackingStep =
  | 'created'
  | 'submitted'
  | 'accepted'
  | 'packing'
  | 'ready_to_ship'
  | 'in_route'
  | 'delivered'
  | 'cancelled';

export type MobileOrderTrackingSummary = {
  currentStep: MobileOrderPrimaryTrackingStep;
  currentStepLabel: string;
  currentStatus: ClienteMobileOrderStatus;
  completedSteps: string[];
  nextStep: string | null;
  nextStepLabel: string | null;
  isTerminal: boolean;
};

type TrackingTimelineOrderInput = {
  id: number;
  status: ClienteMobileOrderStatus;
  createdAt: Date | null;
  submittedAt: Date | null;
  deliveryType: ClienteMobileOrderDeliveryType | null;
};

type TrackingTimelineHistoryInput = {
  id: number;
  previousStatus: string | null;
  status: string;
  message: string | null;
  changedBy: string | null;
  notifyCustomer: boolean;
  createdAt: Date;
};

type TrackingTimelineLegacyDocumentInput = {
  id: number;
  legacyDocId: number;
  pedidoId: number | null;
  folio: string | null;
  estado: string | null;
  tipo: string | null;
  isFacturado: boolean;
  isCancelled: boolean;
  facturadoAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export function buildMobileOrderTrackingTimeline(input: {
  order: TrackingTimelineOrderInput;
  history: TrackingTimelineHistoryInput[];
  legacyDocuments: TrackingTimelineLegacyDocumentInput[];
}) {
  const items: MobileOrderTrackingTimelineItem[] = [];

  if (input.order.createdAt) {
    items.push({
      key: `order-created-${input.order.id}`,
      step: 'created',
      stepLabel: 'Creado',
      type: 'order_created',
      title: 'Pedido creado en la app',
      message: `Se creo el pedido #${input.order.id} como borrador.`,
      occurredAt: input.order.createdAt,
      status: ClienteMobileOrderStatus.DRAFT,
      source: 'mobile',
      changedBy: 'cliente-mobile',
      notifyCustomer: false,
      isCurrentStep: input.order.status === ClienteMobileOrderStatus.DRAFT,
      isCompletedStep: true,
      isTerminalStep: false,
      legacyDocId: null,
      pedidoId: null,
      folio: null,
      metadata: {
        orderId: input.order.id,
      },
    });
  }

  if (input.order.submittedAt) {
    items.push({
      key: `order-submitted-${input.order.id}`,
      step: 'submitted',
      stepLabel: 'Enviado',
      type: 'order_submitted',
      title: 'Pedido enviado',
      message: `El pedido #${input.order.id} fue enviado para procesamiento.`,
      occurredAt: input.order.submittedAt,
      status: ClienteMobileOrderStatus.SUBMITTED,
      source: 'mobile',
      changedBy: 'cliente-mobile',
      notifyCustomer: false,
      isCurrentStep: input.order.status === ClienteMobileOrderStatus.SUBMITTED,
      isCompletedStep: input.order.status !== ClienteMobileOrderStatus.DRAFT,
      isTerminalStep: false,
      legacyDocId: null,
      pedidoId: null,
      folio: null,
      metadata: {
        orderId: input.order.id,
        deliveryType: input.order.deliveryType,
      },
    });
  }

  for (const historyItem of input.history) {
    items.push({
      key: `history-${historyItem.id}`,
      step: mapStatusToStep(historyItem.status),
      stepLabel: mapStepToLabel(mapStatusToStep(historyItem.status)),
      type: 'status_changed',
      title: buildStatusTitle(historyItem.status),
      message: historyItem.message ?? buildStatusMessage(historyItem.status, input.order.id),
      occurredAt: historyItem.createdAt,
      status: historyItem.status,
      source: resolveHistorySource(historyItem.changedBy),
      changedBy: historyItem.changedBy,
      notifyCustomer: Boolean(historyItem.notifyCustomer),
      isCurrentStep: historyItem.status === input.order.status,
      isCompletedStep: true,
      isTerminalStep: isTerminalStatus(historyItem.status),
      legacyDocId: null,
      pedidoId: null,
      folio: null,
      metadata: {
        orderId: input.order.id,
        previousStatus: historyItem.previousStatus,
        status: historyItem.status,
      },
    });
  }

  for (const document of input.legacyDocuments) {
    items.push({
      key: `legacy-document-created-${document.id}`,
      step: 'documents',
      stepLabel: 'Documentos',
      type: 'legacy_document_created',
      title: 'Documento generado en legacy',
      message: document.folio
        ? `Se genero el documento ${document.folio} para este pedido.`
        : `Se genero un documento legacy para este pedido.`,
      occurredAt: document.createdAt,
      status: null,
      source: 'legacy',
      changedBy: 'legacy',
      notifyCustomer: false,
      isCurrentStep: false,
      isCompletedStep: true,
      isTerminalStep: false,
      legacyDocId: document.legacyDocId,
      pedidoId: document.pedidoId,
      folio: document.folio,
      metadata: {
        legacyDocId: document.legacyDocId,
        pedidoId: document.pedidoId,
        estado: document.estado,
        tipo: document.tipo,
      },
    });

    if (document.isFacturado && document.facturadoAt) {
      items.push({
        key: `legacy-document-invoiced-${document.id}`,
        step: 'invoiced',
        stepLabel: 'Facturado',
        type: 'legacy_document_invoiced',
        title: 'Documento facturado',
        message: document.folio
          ? `El documento ${document.folio} ya fue facturado.`
          : 'Se detecto una factura relacionada con este pedido.',
        occurredAt: document.facturadoAt,
        status: ClienteMobileOrderStatus.READY_TO_SHIP,
        source: 'legacy',
        changedBy: 'legacy',
        notifyCustomer: false,
        isCurrentStep: false,
        isCompletedStep: true,
        isTerminalStep: false,
        legacyDocId: document.legacyDocId,
        pedidoId: document.pedidoId,
        folio: document.folio,
        metadata: {
          legacyDocId: document.legacyDocId,
          pedidoId: document.pedidoId,
          estado: document.estado,
        },
      });
    }

    if (document.isCancelled) {
      items.push({
        key: `legacy-document-cancelled-${document.id}`,
        step: 'cancelled',
        stepLabel: 'Cancelado',
        type: 'legacy_document_cancelled',
        title: 'Documento cancelado',
        message: document.folio
          ? `El documento ${document.folio} fue cancelado en legacy.`
          : 'Se detecto la cancelacion de un documento relacionado con este pedido.',
        occurredAt: document.updatedAt ?? document.createdAt,
        status: ClienteMobileOrderStatus.CANCELLED,
        source: 'legacy',
        changedBy: 'legacy',
        notifyCustomer: false,
        isCurrentStep: input.order.status === ClienteMobileOrderStatus.CANCELLED,
        isCompletedStep: true,
        isTerminalStep: true,
        legacyDocId: document.legacyDocId,
        pedidoId: document.pedidoId,
        folio: document.folio,
        metadata: {
          legacyDocId: document.legacyDocId,
          pedidoId: document.pedidoId,
          estado: document.estado,
        },
      });
    }
  }

  return items
    .filter((item) => item.occurredAt instanceof Date)
    .sort((a, b) => {
      const timeDiff = a.occurredAt!.getTime() - b.occurredAt!.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return a.key.localeCompare(b.key);
    });
}

export function buildMobileOrderTrackingSummary(orderStatus: ClienteMobileOrderStatus) {
  const currentStep = mapStatusToStep(orderStatus);
  const stepSequence = [
    'created',
    'submitted',
    'accepted',
    'packing',
    'ready_to_ship',
    'in_route',
    'delivered',
  ];

  if (currentStep === 'cancelled') {
    return {
      currentStep,
      currentStepLabel: mapStepToLabel(currentStep),
      currentStatus: orderStatus,
      completedSteps: ['created', 'submitted', 'cancelled'],
      nextStep: null,
      nextStepLabel: null,
      isTerminal: true,
    } satisfies MobileOrderTrackingSummary;
  }

  const currentIndex = stepSequence.indexOf(currentStep);
  const completedSteps = currentIndex >= 0
    ? stepSequence.slice(0, currentIndex + 1)
    : ['created'];
  const nextStep = currentIndex >= 0 && currentIndex + 1 < stepSequence.length
    ? stepSequence[currentIndex + 1]
    : null;

  return {
    currentStep,
    currentStepLabel: mapStepToLabel(currentStep),
    currentStatus: orderStatus,
    completedSteps,
    nextStep,
    nextStepLabel: nextStep ? mapStepToLabel(nextStep as MobileOrderTrackingTimelineItem['step']) : null,
    isTerminal: currentStep === 'delivered',
  } satisfies MobileOrderTrackingSummary;
}

function resolveHistorySource(changedBy: string | null) {
  const normalized = (changedBy ?? '').toLowerCase();
  if (normalized.includes('sincronizacion')) {
    return 'sync';
  }

  if (normalized.includes('backoffice') || normalized.includes('intranet')) {
    return 'backoffice';
  }

  if (normalized.includes('mobile') || normalized.includes('cliente')) {
    return 'mobile';
  }

  return 'backoffice';
}

function mapStatusToStep(status: string): MobileOrderPrimaryTrackingStep {
  switch (status) {
    case ClienteMobileOrderStatus.SUBMITTED:
      return 'submitted';
    case ClienteMobileOrderStatus.ACCEPTED:
      return 'accepted';
    case ClienteMobileOrderStatus.PACKING:
      return 'packing';
    case ClienteMobileOrderStatus.READY_TO_SHIP:
      return 'ready_to_ship';
    case ClienteMobileOrderStatus.IN_ROUTE:
      return 'in_route';
    case ClienteMobileOrderStatus.DELIVERED:
      return 'delivered';
    case ClienteMobileOrderStatus.CANCELLED:
      return 'cancelled';
    case ClienteMobileOrderStatus.DRAFT:
    default:
      return 'created';
  }
}

function mapStepToLabel(step: MobileOrderTrackingTimelineItem['step']) {
  switch (step) {
    case 'created':
      return 'Creado';
    case 'submitted':
      return 'Enviado';
    case 'accepted':
      return 'Aceptado';
    case 'packing':
      return 'En surtido';
    case 'ready_to_ship':
      return 'Listo';
    case 'in_route':
      return 'En camino';
    case 'delivered':
      return 'Entregado';
    case 'cancelled':
      return 'Cancelado';
    case 'documents':
      return 'Documentos';
    case 'invoiced':
      return 'Facturado';
    default:
      return 'Seguimiento';
  }
}

function isTerminalStatus(status: string) {
  return status === ClienteMobileOrderStatus.DELIVERED
    || status === ClienteMobileOrderStatus.CANCELLED;
}

function buildStatusTitle(status: string) {
  switch (status) {
    case ClienteMobileOrderStatus.ACCEPTED:
      return 'Pedido aceptado';
    case ClienteMobileOrderStatus.PACKING:
      return 'Pedido en surtido';
    case ClienteMobileOrderStatus.READY_TO_SHIP:
      return 'Pedido listo';
    case ClienteMobileOrderStatus.IN_ROUTE:
      return 'Pedido en camino';
    case ClienteMobileOrderStatus.DELIVERED:
      return 'Pedido entregado';
    case ClienteMobileOrderStatus.CANCELLED:
      return 'Pedido cancelado';
    default:
      return 'Actualizacion del pedido';
  }
}

function buildStatusMessage(status: string, orderId: number) {
  switch (status) {
    case ClienteMobileOrderStatus.ACCEPTED:
      return `Tu pedido #${orderId} fue aceptado.`;
    case ClienteMobileOrderStatus.PACKING:
      return `Tu pedido #${orderId} esta siendo surtido.`;
    case ClienteMobileOrderStatus.READY_TO_SHIP:
      return `Tu pedido #${orderId} ya esta listo.`;
    case ClienteMobileOrderStatus.IN_ROUTE:
      return `Tu pedido #${orderId} va en camino.`;
    case ClienteMobileOrderStatus.DELIVERED:
      return `Tu pedido #${orderId} fue entregado.`;
    case ClienteMobileOrderStatus.CANCELLED:
      return `Tu pedido #${orderId} fue cancelado.`;
    default:
      return `El pedido #${orderId} tuvo una actualizacion.`;
  }
}
