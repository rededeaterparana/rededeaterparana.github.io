import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Visao } from './pages/Visao';
import { Infraestrutura } from './pages/Infraestrutura';
import { Lista } from './pages/Lista';

export function App() {
  return (
    <HashRouter>
      <div className="layout">
        <nav className="nav">
          <span className="titulo">Painel — Rede Estadual de ATER</span>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'ativo' : ''}>Visão</NavLink>
          <NavLink to="/infraestrutura" className={({ isActive }) => isActive ? 'ativo' : ''}>Infraestrutura</NavLink>
          <NavLink to="/lista" className={({ isActive }) => isActive ? 'ativo' : ''}>Lista</NavLink>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Visao />} />
            <Route path="/infraestrutura" element={<Infraestrutura />} />
            <Route path="/lista" element={<Lista />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
