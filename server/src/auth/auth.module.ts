import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';

@Module({ controllers: [AuthController], providers: [OtpService, TokensService], exports: [TokensService] })
export class AuthModule {}
