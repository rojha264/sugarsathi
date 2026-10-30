import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from './auth.decorators';
import { PrismaService } from './prisma.service';

/**
 * Who may see a patient's data: the patient, their assigned dietitian, the owner,
 * and (read-only, via family endpoints) approved caregivers.
 */
@Injectable()
export class AccessService {
  constructor(private readonly db: PrismaService) {}

  /** Staff access check; throws when a dietitian opens someone else's patient. */
  async assertStaffCanSee(user: AuthUser, patientId: string) {
    const p = await this.db.patient.findUnique({ where: { userId: patientId }, select: { assignedDietitianId: true } });
    if (!p) throw new NotFoundException('patient_not_found');
    if (user.role === 'OWNER') return;
    if (user.role === 'DIETITIAN' && p.assignedDietitianId === user.id) return;
    throw new ForbiddenException('not_your_patient');
  }

  /** Prisma filter limiting patient lists to what this staff member may see. */
  patientScope(user: AuthUser) {
    return user.role === 'OWNER' ? {} : { assignedDietitianId: user.id };
  }

  /** Caregiver read access through an approved family circle. */
  async assertCaregiver(userId: string, patientId: string) {
    const m = await this.db.circleMember.findFirst({ where: { userId, status: 'active', circle: { patientId } } });
    if (!m) throw new ForbiddenException('not_following');
    return m;
  }
}
