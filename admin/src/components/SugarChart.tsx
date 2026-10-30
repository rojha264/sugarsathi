import dayjs from 'dayjs';
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Reading = { value: number; ctx: string; at: string };

/** Fasting and after-meal readings over time, with the target band (70–180) shaded. */
export function SugarChart({ readings }: { readings: Reading[] }) {
  const data = readings.map((r) => ({ t: dayjs(r.at).valueOf(), fasting: r.ctx === 'fasting' ? r.value : undefined, after: r.ctx === 'after' ? r.value : undefined, random: r.ctx === 'random' ? r.value : undefined }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: -10, right: 10, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <ReferenceArea y1={70} y2={180} fill="#52c41a" fillOpacity={0.08} />
        <ReferenceLine y={70} stroke="#ff4d4f" strokeDasharray="4 4" />
        <ReferenceLine y={180} stroke="#faad14" strokeDasharray="4 4" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={(t) => dayjs(t).format('D MMM')} />
        <YAxis domain={[40, 'dataMax + 20']} />
        <Tooltip labelFormatter={(t) => dayjs(t as number).format('D MMM, h:mm A')} />
        <Legend />
        <Line dataKey="fasting" name="Fasting" stroke="#1677ff" connectNulls dot={{ r: 3 }} />
        <Line dataKey="after" name="2 h after meal" stroke="#eb2f96" connectNulls dot={{ r: 3 }} />
        <Line dataKey="random" name="Random" stroke="#8c8c8c" connectNulls dot={{ r: 2 }} strokeDasharray="3 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}
