import { Injectable, Logger } from '@nestjs/common';
import { TransUnionProvider } from './transunion.provider';
import { EquifaxProvider } from './equifax.provider';
import { ExperianProvider } from './experian.provider';
import type { CreditBureauProvider } from './bureau.interface';

/**
 * Factory that manages all registered credit bureau providers.
 *
 * Responsibilities:
 * - Determine which providers are available based on configuration
 * - Return configured providers or fall back to simulated data
 * - Provide a default provider for convenience methods
 */
@Injectable()
export class BureauFactory {
  private readonly logger = new Logger(BureauFactory.name);
  private readonly providers: CreditBureauProvider[];

  constructor(
    private readonly transunion: TransUnionProvider,
    private readonly equifax: EquifaxProvider,
    private readonly experian: ExperianProvider,
  ) {
    this.providers = [this.transunion, this.equifax, this.experian];

    const configured = this.providers.filter((p) => p.isConfigured);
    if (configured.length > 0) {
      this.logger.log(
        `Bureau factory ready. Configured bureaus: [${configured.map((p) => p.name).join(', ')}]`,
      );
    } else {
      this.logger.warn(
        'No credit bureau API keys configured. All bureau providers will return simulated data.',
      );
    }
  }

  /**
   * Get the default (preferred) provider.
   * Preference order: TransUnion > Equifax > Experian.
   * If none are configured, returns TransUnion (which will use simulated data).
   */
  getDefaultProvider(): CreditBureauProvider {
    const configured = this.providers.find((p) => p.isConfigured);
    return configured ?? this.transunion;
  }

  /**
   * Get a specific provider by name.
   */
  getProvider(name: string): CreditBureauProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  /**
   * Get all providers (configured or not -- they all fall back to simulated data).
   */
  getAllProviders(): CreditBureauProvider[] {
    return this.providers;
  }

  /**
   * Get only providers that have real API keys configured.
   */
  getConfiguredProviders(): CreditBureauProvider[] {
    return this.providers.filter((p) => p.isConfigured);
  }

  /**
   * Whether any bureau has real API credentials configured.
   */
  hasConfiguredProvider(): boolean {
    return this.providers.some((p) => p.isConfigured);
  }

  /**
   * Return info about all available bureaus and their configuration state.
   */
  getAvailableBureaus(): { name: string; configured: boolean }[] {
    return this.providers.map((p) => ({
      name: p.name,
      configured: p.isConfigured,
    }));
  }
}
