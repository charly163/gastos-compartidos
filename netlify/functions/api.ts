import { neon } from '@netlify/neon';

const sql = neon();

type RequestBody = {
    action?: string;
    eventId?: string;
    nombre?: string;
    participanteId?: string;
    item?: string;
    monto?: number;
    id?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

export default async (request: Request) => {
    try {
        if (request.method === 'GET') {
            const eventId = new URL(request.url).searchParams.get('eventId');
            if (!eventId) return json({ error: 'Falta eventId.' }, 400);

            const [participantes, gastos] = await Promise.all([
                sql`SELECT id, event_id, nombre FROM participantes WHERE event_id = ${eventId} ORDER BY nombre`,
                sql`SELECT g.id, g.event_id, g.participante_id, g.item, g.monto, p.nombre AS participante_nombre
            FROM gastos g
            JOIN participantes p ON p.id = g.participante_id
            WHERE g.event_id = ${eventId}
            ORDER BY g.created_at DESC`,
            ]);

            return json({
                participantes, gastos: gastos.map((gasto) => ({
                    id: gasto.id,
                    event_id: gasto.event_id,
                    participante_id: gasto.participante_id,
                    item: gasto.item,
                    monto: Number(gasto.monto),
                    participante: { id: gasto.participante_id, nombre: gasto.participante_nombre },
                }))
            });
        }

        const body = await request.json() as RequestBody;

        if (body.action === 'crear-evento') {
            const [evento] = await sql`INSERT INTO eventos (nombre) VALUES (${body.nombre}) RETURNING id, nombre`;
            return json(evento, 201);
        }

        if (body.action === 'agregar-participante') {
            const [participante] = await sql`INSERT INTO participantes (event_id, nombre)
        VALUES (${body.eventId}, ${body.nombre}) RETURNING id, event_id, nombre`;
            return json(participante, 201);
        }

        if (body.action === 'eliminar-participante') {
            await sql`DELETE FROM participantes WHERE id = ${body.id}`;
            return json({ ok: true });
        }

        if (body.action === 'agregar-gasto') {
            const [gasto] = await sql`INSERT INTO gastos (event_id, participante_id, item, monto)
        VALUES (${body.eventId}, ${body.participanteId}, ${body.item}, ${body.monto})
        RETURNING id, event_id, participante_id, item, monto`;
            return json(gasto, 201);
        }

        if (body.action === 'eliminar-gasto') {
            await sql`DELETE FROM gastos WHERE id = ${body.id}`;
            return json({ ok: true });
        }

        return json({ error: 'Acción no válida.' }, 400);
    } catch (error) {
        console.error(error);
        return json({ error: 'Error interno de base de datos.' }, 500);
    }
};