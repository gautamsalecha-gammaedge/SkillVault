import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { HelpCircle, Lightbulb, Ticket, Users, Factory, UserCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader, StatTile, Card, FullPageLoader } from '../../components/ui';

const PIE_COLORS = ['#FFB020', '#43E5C0', '#8B9AB8', '#FF5D5D'];

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => { api.analytics().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <FullPageLoader label="Crunching numbers…" />;
  if (!data) return null;

  const { summary, questions_by_machine, tips_by_machine, tickets_by_status } = data;
  const ticketPie = Object.entries(tickets_by_status).map(([name, value]) => ({ name, value })).filter((d) => d.value > 0);

  return (
    <div>
      <PageHeader eyebrow="Supervisor console" title="Analytics" description="A live pulse on the floor — questions, knowledge, tickets, people." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile label="Questions asked" value={summary.total_questions} icon={HelpCircle} />
        <StatTile label="Tips pending" value={summary.tips_pending} tone="amber" icon={Lightbulb} />
        <StatTile label="Open tickets" value={summary.open_tickets} tone={summary.open_tickets ? 'amber' : 'signal'} icon={Ticket} />
        <StatTile label="Approved workers" value={summary.total_workers} icon={Users} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatTile label="Machines tracked" value={summary.machines_count} icon={Factory} />
        <StatTile label="Tips approved" value={summary.tips_approved} icon={Lightbulb} />
        <StatTile label="Pending workers" value={summary.pending_workers} tone={summary.pending_workers ? 'amber' : 'signal'} icon={UserCheck} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <h3 className="font-display font-bold text-lg mb-5">Questions by machine</h3>
          {questions_by_machine.length === 0 ? <p className="text-muted text-sm">No questions logged yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={questions_by_machine}>
                <CartesianGrid stroke="#223252" vertical={false} />
                <XAxis dataKey="machine_id" stroke="#8B9AB8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8B9AB8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#121B2E', border: '1px solid #223252', borderRadius: 10, fontSize: 12 }} cursor={{ fill: 'rgba(67,229,192,0.06)' }} />
                <Bar dataKey="count" fill="#43E5C0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-bold text-lg mb-5">Tips by machine</h3>
          {tips_by_machine.length === 0 ? <p className="text-muted text-sm">No tips submitted yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tips_by_machine}>
                <CartesianGrid stroke="#223252" vertical={false} />
                <XAxis dataKey="machine_id" stroke="#8B9AB8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8B9AB8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#121B2E', border: '1px solid #223252', borderRadius: 10, fontSize: 12 }} cursor={{ fill: 'rgba(255,176,32,0.06)' }} />
                <Bar dataKey="count" fill="#FFB020" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display font-bold text-lg mb-5">Tickets by status</h3>
          {ticketPie.length === 0 ? <p className="text-muted text-sm">No tickets raised yet.</p> : (
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie data={ticketPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {ticketPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#0B1220" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#121B2E', border: '1px solid #223252', borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {ticketPie.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted">{d.name}</span>
                    <span className="font-mono font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
