import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaidProvider } from './plaid.provider';
import { Products, SandboxItemFireWebhookRequestWebhookCodeEnum } from 'plaid';

/**
 * Sandbox-only helpers for testing the full Plaid integration flow
 * without requiring the Plaid Link UI.
 *
 * All methods throw ForbiddenException if PLAID_ENV is not 'sandbox'.
 */
@Injectable()
export class PlaidSandboxService {
  private readonly logger = new Logger(PlaidSandboxService.name);
  private readonly isSandbox: boolean;

  constructor(
    private readonly plaidProvider: PlaidProvider,
    private readonly configService: ConfigService,
  ) {
    this.isSandbox =
      this.configService.get<string>('PLAID_ENV', 'sandbox') === 'sandbox';
  }

  /**
   * Guard that throws if we are not running in sandbox mode.
   */
  private assertSandbox() {
    if (!this.isSandbox) {
      throw new ForbiddenException(
        'Sandbox endpoints are only available when PLAID_ENV=sandbox',
      );
    }
  }

  /**
   * Create a sandbox public token that can be exchanged just like a real
   * public token from Plaid Link. This allows testing the full
   * exchange -> store -> sync flow without the Link UI.
   *
   * Uses institution 'ins_109508' (First Platypus Bank) which is Plaid's
   * standard sandbox test institution.
   */
  async createSandboxPublicToken(options?: {
    institutionId?: string;
    products?: string[];
  }): Promise<{ publicToken: string; institutionId: string }> {
    this.assertSandbox();

    const institutionId = options?.institutionId ?? 'ins_109508';
    const products = (options?.products ?? ['transactions']).map(
      (p) => p as Products,
    );

    this.logger.log(
      `Creating sandbox public token for institution ${institutionId}`,
    );

    const response =
      await this.plaidProvider.client.sandboxPublicTokenCreate({
        institution_id: institutionId,
        initial_products: products,
        options: {
          webhook: this.configService.get<string>('PLAID_WEBHOOK_URL'),
        },
      });

    return {
      publicToken: response.data.public_token,
      institutionId,
    };
  }

  /**
   * Fire a sandbox webhook for a given access token. Useful for testing
   * webhook handling without waiting for real events.
   */
  async fireSandboxWebhook(
    accessToken: string,
    webhookCode?: SandboxItemFireWebhookRequestWebhookCodeEnum,
  ): Promise<{ fired: boolean }> {
    this.assertSandbox();

    const code =
      webhookCode ??
      SandboxItemFireWebhookRequestWebhookCodeEnum.DefaultUpdate;

    this.logger.log(`Firing sandbox webhook: ${code}`);

    await this.plaidProvider.client.sandboxItemFireWebhook({
      access_token: accessToken,
      webhook_code: code,
    });

    return { fired: true };
  }

  /**
   * Reset the login for a sandbox item, putting it into an
   * ITEM_LOGIN_REQUIRED state. Useful for testing re-authentication flows.
   */
  async resetSandboxLogin(
    accessToken: string,
  ): Promise<{ reset: boolean }> {
    this.assertSandbox();

    this.logger.log('Resetting sandbox item login');

    await this.plaidProvider.client.sandboxItemResetLogin({
      access_token: accessToken,
    });

    return { reset: true };
  }
}
