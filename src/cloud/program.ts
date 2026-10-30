import { api } from './client';
import { useCloud, type ProgramDetail } from './store';

/** Today's programme day, tips, results and the offer (cached so screens open instantly and offline). */
export async function fetchProgram() {
  try {
    const d = await api<ProgramDetail>('/me/program');
    useCloud.setState({ programDetail: d });
    return d;
  } catch {
    return useCloud.getState().programDetail;
  }
}

/** "Continue with my dietitian": they get a chat message and arrange the plan. */
export async function sendInterest(planId: string) {
  await api('/me/program/interest', { json: { planId } });
}
