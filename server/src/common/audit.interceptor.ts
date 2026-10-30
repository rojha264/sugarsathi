import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';

import { PrismaService } from './prisma.service';

/** Records every staff request that touches a patient (health data access trail). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly db: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { id: string; role: string } | undefined;
    const path: string = req.route?.path ?? req.path;
    const patientId: string | undefined = path.startsWith('/admin/patients/:id') ? req.params.id : req.query?.patientId ?? req.body?.patientId;
    if (!user || user.role === 'USER' || !patientId) return next.handle();
    return next.handle().pipe(
      tap(() => {
        this.db.auditLog.create({ data: { actorId: user.id, action: `${req.method} ${path}`, entity: 'patient', entityId: String(patientId) } }).catch(() => {});
      }),
    );
  }
}
