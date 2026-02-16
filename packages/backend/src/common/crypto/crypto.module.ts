import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [CryptoService, EncryptionService],
  exports: [CryptoService, EncryptionService],
})
export class CryptoModule {}
