import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const API_URL = process.env.REACT_APP_API_URL || '/.netlify/functions/api';

const apiRequest = async <T,>(method: 'GET' | 'POST', body?: unknown, query = ''): Promise<T> => {
  const response = await fetch(`${API_URL}${query}`, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Error de comunicación con el servidor.');
  return result as T;
};

interface Evento {
  id: string;
  nombre: string;
}

interface Participante {
  id: string;
  event_id: string;
  nombre: string;
}

interface Gasto {
  id: string;
  event_id: string;
  participante_id: string;
  item: string;
  monto: number;
  participante?: { id: string; nombre: string };
}

const App: React.FC = () => {
  const [eventId, setEventId] = useState('');
  const [eventNombre, setEventNombre] = useState('');
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [nuevoParticipante, setNuevoParticipante] = useState('');
  const [nuevoGasto, setNuevoGasto] = useState({ participante_id: '', item: '', monto: '' });

  const handleCrearEvento = async () => {
    if (!eventNombre.trim()) {
      alert('Por favor, ingresa un nombre para el evento.');
      return;
    }
    try {
      const data = await apiRequest<Evento>('POST', { action: 'crear-evento', nombre: eventNombre.trim() });
      setEventId(data.id);
      setEventNombre('');
    } catch (error) {
      console.error('Error al crear evento:', error);
      alert('Error al crear evento.');
    }
  };

  const handleUnirseEvento = () => {
    if (!eventId.trim()) {
      alert('Por favor, ingresa un ID de evento válido.');
      return;
    }
    setEventId(eventId.trim());
  };

  useEffect(() => {
    if (!eventId) return;

    const cargarDatos = async () => {
      try {
        const data = await apiRequest<{ participantes: Participante[]; gastos: Gasto[] }>('GET', undefined, `?eventId=${encodeURIComponent(eventId)}`);
        setParticipantes(data.participantes || []);
        setGastos(data.gastos || []);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      }
    };

    cargarDatos();
    const intervalo = window.setInterval(cargarDatos, 10000);

    return () => {
      window.clearInterval(intervalo);
    };
  }, [eventId]);

  // Agregar participante
  const agregarParticipante = async () => {
    if (!nuevoParticipante.trim() || participantes.some(p => p.nombre === nuevoParticipante.trim())) {
      alert('Por favor, ingresa un nombre válido y no repetido.');
      return;
    }
    try {
      await apiRequest<Participante>('POST', { action: 'agregar-participante', eventId, nombre: nuevoParticipante.trim() });
      setNuevoParticipante('');
    } catch (error) {
      console.error('Error al agregar participante:', error);
      alert('Error al agregar participante.');
    }
  };

  // Eliminar participante
  const eliminarParticipante = async (id: string) => {
    if (gastos.some(g => g.participante_id === id)) {
      alert('No puedes eliminar a una persona con gastos registrados.');
      return;
    }
    try {
      await apiRequest('POST', { action: 'eliminar-participante', id });
    } catch (error) {
      console.error('Error al eliminar participante:', error);
      alert('Error al eliminar participante.');
    }
  };

  // Agregar gasto
  const agregarGasto = async () => {
    if (!nuevoGasto.participante_id || !nuevoGasto.item.trim() || !nuevoGasto.monto || parseFloat(nuevoGasto.monto) <= 0) {
      alert('Por favor, selecciona un nombre, ingresa un producto válido y un monto mayor a 0.');
      return;
    }
    try {
      await apiRequest<Gasto>('POST', {
        action: 'agregar-gasto',
        eventId,
        participanteId: nuevoGasto.participante_id,
        item: nuevoGasto.item.trim(),
        monto: parseFloat(nuevoGasto.monto),
      });
      setNuevoGasto({ participante_id: '', item: '', monto: '' });
    } catch (error) {
      console.error('Error al agregar gasto:', error);
      alert('Error al agregar gasto.');
    }
  };

  // Eliminar gasto
  const eliminarGasto = async (id: string) => {
    try {
      await apiRequest('POST', { action: 'eliminar-gasto', id });
    } catch (err) {
      console.error('Error inesperado al eliminar gasto:', err);
      alert('Error inesperado al eliminar gasto.');
    }
  };

  // Obtener nombre del participante basado en participante_id
  const getParticipanteNombre = (participanteId: string) => {
    const participante = participantes.find(p => p.id === participanteId);
    return participante ? participante.nombre : 'Desconocido';
  };

  // Calcular resumen y liquidaciones
  const calcularResumen = () => {
    const totalGastado = gastos.reduce((sum, gasto) => sum + gasto.monto, 0);
    const porPersona = participantes.length > 0 ? totalGastado / participantes.length : 0;
    const saldos: { [key: string]: number } = {};
    participantes.forEach(p => {
      const gastado = gastos.filter(g => g.participante_id === p.id).reduce((sum, g) => sum + g.monto, 0);
      saldos[p.nombre] = gastado - porPersona;
    });

    const liquidaciones: string[] = [];
    const deudores = Object.entries(saldos).filter(([_, saldo]) => saldo < 0);
    const acreedores = Object.entries(saldos).filter(([_, saldo]) => saldo > 0);

    deudores.forEach(([deudor, deuda]) => {
      deuda = -deuda;
      while (deuda > 0.01) {
        let acreedor = acreedores.find(([_, saldo]) => saldo > 0.01);
        if (!acreedor) break;
        const [nombreAcreedor, saldoAcreedor] = acreedor;
        const monto = Math.min(deuda, saldoAcreedor);
        liquidaciones.push(`${deudor} paga a ${nombreAcreedor} $${monto.toFixed(2)}`);
        deuda -= monto;
        acreedor[1] -= monto;
      }
    });

    return { totalGastado, porPersona, saldos, liquidaciones };
  };

  const { totalGastado, porPersona, saldos, liquidaciones } = calcularResumen();

  if (!eventId) {
    return (
      <main className="landing-shell">
        <section className="landing-intro">
          <span className="eyebrow">Gastos compartidos, sin vueltas</span>
          <h1>Cena Justa</h1>
          <p>Organiza la cuenta, registra quién pagó y descubre cómo saldarla en segundos.</p>
          <div className="intro-rule" />
        </section>
        <section className="access-panel">
          <div className="access-block access-primary">
            <span className="step-number">01</span>
            <h2>Crear un evento</h2>
            <p>Empieza una cuenta nueva para tu mesa, viaje o plan.</p>
            <label htmlFor="event-name">Nombre del evento</label>
            <input
              id="event-name"
              type="text"
              value={eventNombre}
              onChange={(e) => setEventNombre(e.target.value)}
              placeholder="Ej. Cena de amigos"
              className="app-input"
            />
            <button
              onClick={handleCrearEvento}
              className="app-button app-button-primary"
            >
              Crear evento <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="access-divider"><span>o</span></div>
          <div className="access-block">
            <span className="step-number">02</span>
            <h2>Unirse a un evento</h2>
            <p>Usa el código que te compartió quien creó la cuenta.</p>
            <label htmlFor="event-id">Código del evento</label>
            <input
              id="event-id"
              type="text"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="Pega aquí el código"
              className="app-input"
            />
            <button
              onClick={handleUnirseEvento}
              className="app-button app-button-secondary"
            >
              Entrar al evento <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">Cuenta compartida</span>
          <h1>Cena Justa</h1>
        </div>
        <button
          onClick={() => setEventId('')}
          className="exit-button"
        >
          Salir
        </button>
      </header>
      <div className="event-code"><span>Código del evento</span><strong>{eventId}</strong></div>

      <section className="workspace-grid">
        <div className="app-panel form-panel">
          <div className="panel-heading"><span className="panel-kicker">Equipo</span><h2>Agregar persona</h2></div>
          <input
            type="text"
            value={nuevoParticipante}
            onChange={(e) => setNuevoParticipante(e.target.value)}
            placeholder="Nombre de la persona"
            className="app-input"
          />
          <button
            onClick={agregarParticipante}
            className="app-button app-button-dark"
          >
            + Agregar persona
          </button>
        </div>

        <div className="app-panel people-panel">
          <div className="panel-heading panel-heading-row"><div><span className="panel-kicker">Participantes</span><h2>Personas</h2></div><span className="count-badge">{participantes.length}</span></div>
          <ul className="clean-list">
            {participantes.map((p) => (
              <li key={p.id} className="list-row">
                <span className="person-name"><span className="avatar">{p.nombre.charAt(0).toUpperCase()}</span>{p.nombre}</span>
                <button
                  onClick={() => eliminarParticipante(p.id)}
                  className="delete-button"
                >
                  Quitar
                </button>
              </li>
            ))}
            {participantes.length === 0 && <li className="empty-state">Todavía no hay personas en este evento.</li>}
          </ul>
        </div>

        <div className="app-panel expense-panel">
          <div className="panel-heading"><span className="panel-kicker">Nuevo movimiento</span><h2>Agregar gasto</h2></div>
          <div className="form-fields">
            <select
              value={nuevoGasto.participante_id}
              onChange={(e) => setNuevoGasto({ ...nuevoGasto, participante_id: e.target.value })}
              className="app-input"
            >
              <option value="" disabled>Quién pagó</option>
              {participantes.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <input
              type="text"
              value={nuevoGasto.item}
              onChange={(e) => setNuevoGasto({ ...nuevoGasto, item: e.target.value })}
              placeholder="Qué se compró"
              className="app-input"
            />
            <input
              type="number"
              value={nuevoGasto.monto}
              onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })}
              placeholder="Monto"
              step="0.01"
              className="app-input"
            />
            <button
              onClick={agregarGasto}
              className="app-button app-button-primary"
            >
              Guardar gasto <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <div className="app-panel expense-list-panel">
          <div className="panel-heading panel-heading-row"><div><span className="panel-kicker">Historial</span><h2>Gastos registrados</h2></div><span className="count-badge">{gastos.length}</span></div>
          <ul className="clean-list">
            {gastos.map((g) => (
              <li key={g.id} className="list-row expense-row">
                <span className="expense-description">
                  <span className="expense-dot" />
                  {g.participante?.nombre || getParticipanteNombre(g.participante_id)} compró {g.item} por ${g.monto.toFixed(2)}
                </span>
                <button
                  onClick={() => eliminarGasto(g.id)}
                  className="delete-button"
                >
                  Quitar
                </button>
              </li>
            ))}
            {gastos.length === 0 && <li className="empty-state">Los gastos que agregues aparecerán aquí.</li>}
          </ul>
        </div>

        <div className="app-panel summary-panel">
          <span className="panel-kicker">En números</span><h2>Resumen</h2>
          <div className="summary-stats">
            <div><span>Total gastado</span><strong>${totalGastado.toFixed(2)}</strong></div>
            <div><span>Por persona</span><strong>${porPersona.toFixed(2)}</strong></div>
          </div>

          <div className="summary-section">
            <h3>Saldos</h3>
            <ul className="clean-list">
              {Object.entries(saldos).map(([persona, saldo]) => (
                <li key={persona} className="balance-row">
                  <span>{persona}</span>
                  <strong className={saldo >= 0 ? 'positive-balance' : 'negative-balance'}>
                    ${saldo.toFixed(2)}
                  </strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="summary-section settlement-section">
            <h3>Liquidaciones</h3>
            <ul className="clean-list">
              {liquidaciones.map((l, index) => (
                <li key={index} className="settlement-row"><span>→</span>{l}</li>
              ))}
              {liquidaciones.length === 0 && <li className="empty-state">Todo está equilibrado por ahora.</li>}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);