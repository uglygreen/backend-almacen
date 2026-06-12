import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { envString } from '../../config/runtime-env';
import { DeviceToken } from '../../entities';

type PushSendInput = {
  customerId: number;
  notificationId: number;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  tokens: DeviceToken[];
};

type PushSendFailure = {
  tokenId: number;
  code: string | null;
  message: string | null;
};

export type PushSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokenIds: number[];
  messageIds: string[];
  failures: PushSendFailure[];
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly defaultCredentialsFile = 'ferreclientes-4f214-firebase-adminsdk-fbsvc-29f985f65a.json';
  private readonly firebaseAppName = 'backend-almacen-push';
  private readonly defaultNotificationImageUrl = 'https://ferremayoristas.com.mx/assets/logo.png';

  async sendToDevices(input: PushSendInput): Promise<PushSendResult> {
    const uniqueTokens = this.getUniqueActiveTokens(input.tokens);
    if (!uniqueTokens.length) {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokenIds: [],
        messageIds: [],
        failures: [],
      };
    }

    const messaging = this.getMessaging();
    const imageUrl = this.getNotificationImageUrl();
    const response = await messaging.sendEachForMulticast({
      tokens: uniqueTokens.map((token) => token.fcmToken),
      notification: {
        title: input.title,
        body: input.body,
        imageUrl,
      },
      data: this.normalizeData({
        customerId: input.customerId,
        notificationId: input.notificationId,
        type: input.type,
        imageUrl,
        ...input.data,
      }),
      android: {
        priority: 'high',
        notification: {
          imageUrl,
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            'mutable-content': 1,
          },
        },
        fcmOptions: {
          imageUrl,
        },
      },
    });

    const invalidTokenIds: number[] = [];
    const messageIds: string[] = [];
    const failures: PushSendFailure[] = [];

    response.responses.forEach((result, index) => {
      const token = uniqueTokens[index];
      if (result.success) {
        if (result.messageId) {
          messageIds.push(result.messageId);
        }
        return;
      }

      const code = result.error?.code ?? null;
      const message = result.error?.message ?? null;
      failures.push({
        tokenId: token.id,
        code,
        message,
      });

      if (this.isInvalidTokenError(code)) {
        invalidTokenIds.push(token.id);
      }
    });

    if (response.successCount > 0) {
      this.logger.log(
        `Push enviado a cliente ${input.customerId}. Notificacion ${input.notificationId}. Tokens exitosos: ${response.successCount}.`,
      );
    }

    if (response.failureCount > 0) {
      this.logger.warn(
        `Push con errores para cliente ${input.customerId}. Notificacion ${input.notificationId}. Fallos: ${response.failureCount}.`,
      );
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokenIds,
      messageIds,
      failures,
    };
  }

  private getMessaging() {
    return this.getFirebaseApp().messaging();
  }

  private getFirebaseApp(): admin.app.App {
    const existingApp = admin.apps.find((app) => app?.name === this.firebaseAppName);
    if (existingApp) {
      return existingApp;
    }

    const serviceAccount = this.loadServiceAccount();
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.projectId,
      },
      this.firebaseAppName,
    );
  }

  private loadServiceAccount(): admin.ServiceAccount {
    const credentialsPath = envString('GOOGLE_APPLICATION_CREDENTIALS', '').trim();
    if (credentialsPath) {
      return this.readServiceAccountFromFile(credentialsPath);
    }

    const projectId = envString('FIREBASE_PROJECT_ID', '').trim();
    const clientEmail = envString('FIREBASE_CLIENT_EMAIL', '').trim();
    const privateKey = envString('FIREBASE_PRIVATE_KEY', '').trim();
    if (projectId && clientEmail && privateKey) {
      return {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      };
    }

    const fallbackPath = this.findDefaultCredentialsPath();
    if (fallbackPath) {
      this.logger.log(`Usando credenciales Firebase desde archivo ${fallbackPath}`);
      return this.readServiceAccountFromFile(fallbackPath);
    }

    throw new Error(
      'No se encontraron credenciales de Firebase. Configura GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.',
    );
  }

  private readServiceAccountFromFile(filePath: string): admin.ServiceAccount {
    const resolvedPath = this.resolveExistingFilePath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`No se encontró el archivo de credenciales Firebase en ${resolvedPath}`);
    }

    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  private findDefaultCredentialsPath() {
    const candidates = this.getCredentialSearchDirectories()
      .map((basePath) => path.join(basePath, this.defaultCredentialsFile));

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  }

  private resolveExistingFilePath(filePath: string) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    const candidates = this.getCredentialSearchDirectories()
      .map((basePath) => path.resolve(basePath, filePath));

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? path.resolve(process.cwd(), filePath);
  }

  private getCredentialSearchDirectories() {
    const cwd = process.cwd();
    const execDir = (process as any).pkg ? path.dirname(process.execPath) : cwd;
    const projectRootFromModule = path.resolve(__dirname, '../../../');

    return [...new Set([cwd, execDir, projectRootFromModule])];
  }

  private getNotificationImageUrl() {
    return envString('PUSH_NOTIFICATION_IMAGE_URL', this.defaultNotificationImageUrl).trim();
  }

  private getUniqueActiveTokens(tokens: DeviceToken[]) {
    const uniqueByToken = new Map<string, DeviceToken>();
    for (const token of tokens) {
      if (!token.isActive || !token.fcmToken?.trim()) {
        continue;
      }

      if (!uniqueByToken.has(token.fcmToken)) {
        uniqueByToken.set(token.fcmToken, token);
      }
    }

    return Array.from(uniqueByToken.values());
  }

  private normalizeData(data: Record<string, unknown>) {
    return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }

      acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
      return acc;
    }, {});
  }

  private isInvalidTokenError(code: string | null) {
    return code === 'messaging/invalid-registration-token'
      || code === 'messaging/registration-token-not-registered';
  }
}
